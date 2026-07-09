// ============================================================
// Core State
// ============================================================

// ── Shared utilities ──
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ── IndexedDB helpers for FileSystemDirectoryHandle persistence ──
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
  platform: "auto", // 'auto' | 'mizuki' | 'firefly' | 'fuwari'
  configs: {},
  articles: [],
  articleFiltered: [],
  currentPanel: "config",
  modifiedConfigs: new Set(),
  currentArticlePath: null,
};

// ── Platform detection & switching ──
// Uses PLATFORMS from platform.js (attached to window) if available,
// falls back to hardcoded values for early-load compatibility.

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
  // Fallback hardcoded
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

/** "multi" (Firefly/Mizuki) or "single" (Fuwari) — determines file layout */
function getPlatformLayout() {
  return getPlatformInfo().layout || "multi";
}

/** Get the path for importing a type */
function getTypeImportPath(configKey) {
  const info = getPlatformInfo();
  const ti = info.typeImports || {};
  if (ti.overrides && ti.overrides[configKey]) return ti.overrides[configKey];
  return ti.defaultPath || "../types/config";
}

/** Get the LinkPreset prefix for the current platform */
function getLinkPresetPrefix() {
  return getPlatformInfo().linkPresetPrefix || "LinkPreset.";
}

/** Convert configKey to TypeName (e.g., "siteConfig" → "SiteConfig") */
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

// ── Shared utility: debounce ──
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Schema lazy-loading (async, Promise-based) ──
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
