// ============================================================
// 核心状态管理
// ============================================================

// ── 共享工具函数 ──
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ── 用于 FileSystemDirectoryHandle 持久化的 IndexedDB 辅助函数 ──
const DB_NAME = "LeafKit";
const DB_STORE = "handles";

function openDB() {
  return new Promise(function (resolve, reject) {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function (e) {
      e.target.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = function (e) {
      resolve(e.target.result);
    };
    req.onerror = function (e) {
      reject(e.target.error);
    };
  });
}

async function saveDirHandle(handle) {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(handle, "projectDir");
    await new Promise(function (r) { tx.oncomplete = r; });
    db.close();
  } catch (e) {
    console.warn("Failed to persist directory handle:", e);
  }
}

async function loadDirHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readonly");
    const getReq = tx.objectStore(DB_STORE).get("projectDir");
    const handle = await new Promise(function (resolve) {
      getReq.onsuccess = function () { resolve(getReq.result); };
      getReq.onerror = function () { resolve(null); };
    });
    db.close();
    if (!handle) return null;
    const opts = { mode: "readwrite" };
    let ok = (await handle.queryPermission(opts)) === "granted";
    if (!ok) ok = (await handle.requestPermission(opts)) === "granted";
    return ok ? handle : null;
  } catch (e) {
    return null;
  }
}

const STATE = {
  projectDir: null,
  platform: "auto", // 'auto' | 'mizuki' | 'firefly' | 'fuwari'（自动检测/瑞树/Firefly/Fuwari）
  configs: {},
  articles: [],
  articleFiltered: [],
  currentPanel: "config",
  modifiedConfigs: new Set(),
  currentArticlePath: null,
};

// ── 平台检测和切换 ──
// 使用 platform.js 中的 PLATFORMS（挂载在 window 上），
// 如果不可用则回退到硬编码值以保证早期加载兼容性。

function getCurrentPlatform() {
  if (STATE.platform === "auto") {
    const n = (STATE.projectDir && STATE.projectDir.name || "").toLowerCase();
    if (n.indexOf("firefly") >= 0) return "firefly";
    if (n.indexOf("fuwari") >= 0) return "fuwari";
    if (n.indexOf("faras") >= 0 || n.indexOf("mizuki") >= 0) return "mizuki";
    return "mizuki";
  }
  return STATE.platform;
}

function getCurrentSchema() {
  const p = getCurrentPlatform();
  if (p === "firefly") return window.FIREFLY_CONFIG_SCHEMA || {};
  if (p === "fuwari") return window.FUWARI_CONFIG_SCHEMA || {};
  return window.MIZUKI_CONFIG_SCHEMA || {};
}

function getPlatformInfo() {
  const p = getCurrentPlatform();
  if (typeof PLATFORMS !== "undefined" && PLATFORMS[p]) {
    return PLATFORMS[p];
  }
  // 硬编码回退值
  return {
    firefly: { name: "Firefly", accent: "#17824b", hue: 165 },
    fuwari: { name: "Fuwari", accent: "#6080d0", hue: 250 },
    mizuki: { name: "Mizuki", accent: "#e91e63", hue: 340 },
  }[p] || { name: "Mizuki", accent: "#e91e63", hue: 340 };
}

function getPlatformAccent() {
  return getPlatformInfo().accent;
}

function getPlatformHue() {
  return getPlatformInfo().hue;
}

/** "multi" (Firefly/Mizuki) 或 "single" (Fuwari) — 决定文件布局 */
function getPlatformLayout() {
  return getPlatformInfo().layout || "multi";
}

/** 获取类型的导入路径 */
function getTypeImportPath(configKey) {
  const info = getPlatformInfo();
  const ti = info.typeImports || {};
  if (ti.overrides && ti.overrides[configKey]) return ti.overrides[configKey];
  return ti.defaultPath || "../types/config";
}

/** 获取当前平台的 LinkPreset 前缀 */
function getLinkPresetPrefix() {
  return getPlatformInfo().linkPresetPrefix || "LinkPreset.";
}

/** 将 configKey 转换为类型名（例如 "siteConfig" → "SiteConfig"） */
function configKeyToTypeName(configKey) {
  return configKey.charAt(0).toUpperCase() + configKey.slice(1) + "Config";
}

function togglePlatform() {
  const order = ["mizuki", "firefly", "fuwari"];
  const current = getCurrentPlatform();
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  applyPlatformChange(next);
  const autoEl = document.getElementById("settingAutoDetect");
  if (autoEl) autoEl.checked = false;
}

function onPlatformChange(value) {
  STATE.platform = value;
  applyPlatformChange(value);
  const autoEl = document.getElementById("settingAutoDetect");
  if (autoEl) autoEl.checked = (value === "auto");
}

function applyPlatformChange(value) {
  const isAuto = value === "auto";
  if (isAuto) {
    STATE.platform = "auto";
  } else {
    STATE.platform = value;
  }
  updatePlatformUI();
  showPlatformWatermark();
  if (STATE.projectDir) {
    STATE.configs = {};
    STATE.modifiedConfigs.clear();
    loadAllConfigs().then(function () {
      buildConfigUI();
      loadArticles();
      updateStatusDot();
    });
    const info = getPlatformInfo();
    const label = isAuto ? "自动检测 (" + info.name + ")" : info.name;
    showToast("已切换到: " + label, "info");
  }
}

function showPlatformWatermark() {
  const wm = document.getElementById("platformWatermark");
  if (!wm) return;
  wm.textContent = getPlatformInfo().name;
  wm.classList.remove("show");
  void wm.offsetWidth;
  wm.classList.add("show");
}

function applyAccentColor(hex, fromUser) {
  try {
    const s = JSON.parse(localStorage.getItem("MizukiUI_Settings") || "{}");
    if (s.customAccent && !fromUser) return;
  } catch (e) {}
  applyAdminAccent(hex);
}

function updatePlatformUI() {
  const info = getPlatformInfo();
  const labelEl = document.getElementById("platformLabel");
  if (labelEl) labelEl.textContent = info.name;

  const logoEl = document.querySelector(".topbar .logo-text");
  if (logoEl) logoEl.textContent = "LeafKit";
  document.title = "LeafKit";

  // Apply hue transition
  const root = document.documentElement;
  root.style.setProperty("--hue", info.hue);

  // Apply platform accent color
  applyAccentColor(info.accent, false);
  showPlatformWatermark();

  // Update documentation links
  if (typeof updateDocLinks === "function") updateDocLinks(getCurrentPlatform());
}

// ── 共享工具: 防抖函数 ──
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Schema 懒加载（异步，基于 Promise） ──
const _schemaLoaded = {};
const _schemaLoading = {};

function loadPlatformSchema(platform) {
  if (_schemaLoaded[platform]) return Promise.resolve();
  if (_schemaLoading[platform]) return _schemaLoading[platform];
  _schemaLoading[platform] = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = "js/schemas/" + platform + ".js";
    script.onload = function () {
      _schemaLoaded[platform] = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _schemaLoading[platform];
}

const GITHUB_API = "https://api.github.com";
