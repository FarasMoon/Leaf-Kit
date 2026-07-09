// ============================================================
// Publish / Deploy — Unified Terminal
// ============================================================

const TERMINAL_MAX_LINES = 1000;
const TERMINAL_RESTORE_LINES = 500;
const TERMINAL_STORAGE_LINES = 500;

let terminalAutoscroll = true;
let terminalLines = []; // [{type, text, ts}]

function appendTerminal(type, text) {
  const ts = new Date().toLocaleTimeString();
  // Clean: strip remaining ANSI, collapse whitespace, remove dangling newlines
  const clean = String(text || "").replace(/\x1b\[[0-9;]*m/g, "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return;
  terminalLines.push({ type: type, text: clean, ts: ts });

  // Limit terminal lines to prevent unbounded memory growth
  if (terminalLines.length > TERMINAL_MAX_LINES) {
    terminalLines.splice(0, terminalLines.length - TERMINAL_MAX_LINES + 200);
  }

  const body = document.getElementById("terminalBody");
  if (!body) return;

  const line = document.createElement("span");
  line.className = "terminal-line " + type;
  line.innerHTML = '<span class="ts">[' + ts + ']</span>' + escapeHtml(clean);
  body.appendChild(line);

  // Also limit DOM nodes
  while (body.children.length > TERMINAL_MAX_LINES) {
    body.removeChild(body.firstChild);
  }

  if (terminalAutoscroll) {
    body.scrollTop = body.scrollHeight;
  }
}

function restoreTerminal() {
  const body = document.getElementById("terminalBody");
  if (!body) return;

  // Try sessionStorage
  let saved = null;
  try {
    saved = sessionStorage.getItem("leafkit_terminal");
  } catch(e) {
    console.warn("Failed to read terminal session:", e);
  }

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) terminalLines = parsed;
    } catch(e) {
      console.warn("Failed to parse terminal session:", e);
    }
  }

  body.innerHTML = "";
  if (terminalLines.length === 0) {
    body.innerHTML = '<div class="terminal-empty">等待操作...</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  const start = Math.max(0, terminalLines.length - TERMINAL_RESTORE_LINES);
  for (let i = start; i < terminalLines.length; i++) {
    const ln = terminalLines[i];
    const span = document.createElement("span");
    span.className = "terminal-line " + (ln.type || "info");
    span.innerHTML = '<span class="ts">[' + (ln.ts || "") + ']</span>' + escapeHtml(ln.text || "");
    frag.appendChild(span);
  }
  body.appendChild(frag);
  if (terminalAutoscroll) body.scrollTop = body.scrollHeight;
}

// Throttled save to sessionStorage (at most once per second)
let _saveTerminalTimer = null;
function saveTerminal() {
  if (_saveTerminalTimer) return;
  _saveTerminalTimer = setTimeout(function() {
    _saveTerminalTimer = null;
    try {
      // Only save recent lines to keep storage small
      const toSave = terminalLines.slice(-TERMINAL_STORAGE_LINES);
      sessionStorage.setItem("leafkit_terminal", JSON.stringify(toSave));
    } catch(e) {
      console.warn("Failed to save terminal session:", e);
    }
  }, 1000);
}

// Wrap appendTerminal to also save (throttled)
const _origAppendTerminal = appendTerminal;
appendTerminal = function(type, text) {
  _origAppendTerminal(type, text);
  saveTerminal();
};

function clearTerminal() {
  terminalLines = [];
  const body = document.getElementById("terminalBody");
  if (body) {
    body.innerHTML = '<div class="terminal-empty">等待操作...</div>';
  }
  try { sessionStorage.removeItem("leafkit_terminal"); } catch(e) {
    console.warn("Failed to clear terminal session:", e);
  }
}

function toggleTerminalAutoscroll() {
  terminalAutoscroll = !terminalAutoscroll;
  const btn = document.getElementById("btnAutoscroll");
  if (btn) {
    if (terminalAutoscroll) {
      btn.textContent = "自动滚动: 开";
      btn.classList.add("active");
    } else {
      btn.textContent = "自动滚动: 关";
      btn.classList.remove("active");
    }
  }
}

// ── Shared polling dedup helper ──
const _seenPollLines = {};

function pollDedup(key, line) {
  if (!_seenPollLines[key]) _seenPollLines[key] = new Set();
  if (_seenPollLines[key].has(line)) return true;
  _seenPollLines[key].add(line);
  // Keep Set from growing too large
  if (_seenPollLines[key].size > 500) {
    _seenPollLines[key] = new Set(Array.from(_seenPollLines[key]).slice(-200));
  }
  return false;
}

function resetPollDedup(key) {
  _seenPollLines[key] = new Set();
}

// ── Preview ──
let previewPollTimer = null;
let previewPollRunning = false;
let previewRunning = false;
let previewNotifiedUrl = null;

// Toggle preview on/off from topbar button
function togglePreview() {
  if (previewRunning) {
    stopPreview();
  } else {
    startPreview();
  }
}

async function startPreview() {
  if (!STATE.projectDir) { showToast("请先选择项目目录", "error"); return; }
  const projectName = STATE.projectDir.name || "";
  if (!projectName) { showToast("无法获取项目名称", "error"); return; }

  appendTerminal("system", "正在启动预览服务器...");
  const btn = document.getElementById("btnPreviewToggle");
  btn && (btn.disabled = true);

  try {
    const resp = await fetch("/api/preview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName: projectName }),
    });
    const data = await resp.json();
    if (!data.ok) {
      appendTerminal("error", "预览启动失败: " + (data.error || "未知错误"));
      btn && (btn.disabled = false);
      showToast("预览启动失败", "error");
      return;
    }
    appendTerminal("success", "预览服务器已启动");
    showToast("预览服务器已启动，正在获取地址...", "info", 4000);
    pollPreviewOutput();
  } catch (e) {
    appendTerminal("error", "预览启动请求失败: " + e.message);
    btn && (btn.disabled = false);
  }
}

async function stopPreview() {
  try { await fetch("/api/preview/stop", { method: "POST" }); } catch(e) {
    console.warn("Failed to stop preview:", e);
  }
  if (previewPollTimer) { clearTimeout(previewPollTimer); previewPollTimer = null; }
  previewPollRunning = false;
  previewRunning = false;
  previewNotifiedUrl = null;
  updatePreviewToggleUI(false, "");
  updatePreviewUI(false, "");
  appendTerminal("warn", "预览已停止");
  showToast("预览服务器已停止", "info");
}

function pollPreviewOutput() {
  if (previewPollRunning) return;
  previewPollRunning = true;
  resetPollDedup("preview");
  (function poll() {
    fetch("/api/preview/status").then(function(resp) {
      return resp.json();
    }).then(function(data) {
      const lines = data.output.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (pollDedup("preview", line)) continue;

        if (line.startsWith("[ERR]") || line.startsWith("[错误]")) {
          appendTerminal("error", line);
        } else if (line.indexOf("Error") >= 0 || line.indexOf("error") >= 0) {
          appendTerminal("error", line);
        } else if (line.indexOf("200") >= 0 || line.indexOf("ready") >= 0) {
          appendTerminal("success", line);
        } else {
          appendTerminal("info", line);
        }
      }

      if (data.running) {
        previewRunning = true;
        updatePreviewToggleUI(true, data.url);
        updatePreviewUI(true, data.url);
        // Notify user with URL when first detected
        if (data.url && data.url !== previewNotifiedUrl) {
          previewNotifiedUrl = data.url;
          showToast("预览已就绪: " + data.url + " — 点击「浏览器打开」查看", "success", 8000);
        }
        previewPollTimer = setTimeout(poll, 1500);
      } else {
        previewRunning = false;
        let urlFromOutput = data.url;
        if (!urlFromOutput) {
          const m = data.output.match(/https?:\/\/localhost:\d+/);
          if (m) urlFromOutput = m[0];
        }
        updatePreviewToggleUI(false, urlFromOutput);
        updatePreviewUI(false, urlFromOutput);
        previewPollRunning = false;
        const btn = document.getElementById("btnPreviewToggle");
        btn && (btn.disabled = false);
      }
    }).catch(function(e) {
      console.warn("Preview poll error:", e);
      previewPollTimer = setTimeout(poll, 2000);
    });
  })();
}

function updatePreviewToggleUI(running, url) {
  const btn = document.getElementById("btnPreviewToggle");
  if (btn) {
    if (running) {
      btn.textContent = "停止预览";
      btn.className = "btn btn-danger btn-sm";
    } else {
      btn.textContent = "启动预览";
      btn.className = "btn btn-primary btn-sm";
      btn.disabled = false;
    }
  }
}

function updatePreviewUI(running, url) {
  const btnOpen = document.getElementById("btnPreviewOpen");
  const statusEl = document.getElementById("previewStatus");

  if (running) {
    btnOpen && btnOpen.classList.add("hidden");
    statusEl && statusEl.classList.remove("hidden");
  }

  if (url) {
    btnOpen && btnOpen.classList.remove("hidden");
    btnOpen && (btnOpen._previewUrl = url);
  }
}

function openPreviewWindow() {
  const btnOpen = document.getElementById("btnPreviewOpen");
  const url = btnOpen && btnOpen._previewUrl;
  if (!url) { showToast("请等待预览地址检测完成", "warn"); return; }
  window.open(url, "_blank", "noopener,noreferrer");
}

// ── GitHub / Git Push (SSH) ──
let gitPushPollTimer = null;

function getGitHubConfig() {
  let owner = "", repo = "", branch = "gh-pages", remoteUrl = "";
  try {
    const s = JSON.parse(localStorage.getItem("MizukiUI_Settings") || "{}");
    if (s.gitRepo) {
      const parts = s.gitRepo.split("/");
      if (parts[0]) owner = parts[0];
      if (parts[1]) repo = parts[1];
    }
    if (s.gitBranch) branch = s.gitBranch;
    if (s.gitRemote) remoteUrl = s.gitRemote;
  } catch(e) {
    console.warn("Failed to parse GitHub config:", e);
  }
  if (!owner) owner = localStorage.getItem("gh_owner") || "";
  if (!repo) repo = localStorage.getItem("gh_repo") || "";
  if (!branch) {
    const b = localStorage.getItem("gh_branch") || "";
    if (b) branch = b; else branch = "gh-pages";
  }
  if (!remoteUrl && owner && repo) {
    remoteUrl = "git@github.com:" + owner + "/" + repo + ".git";
  }
  return { owner: owner, repo: repo, branch: branch, remoteUrl: remoteUrl };
}

function updatePublishRepoDisplay() {
  const config = getGitHubConfig();
  const el = document.getElementById("pushRepoUrl");
  if (el) {
    if (config.owner && config.repo) {
      const mode = config.remoteUrl && config.remoteUrl.startsWith("git@") ? "SSH" : "HTTPS";
      el.textContent = config.owner + "/" + config.repo + " (" + mode + " → " + config.branch + ")";
    } else {
      el.textContent = "请在设置中配置仓库";
    }
  }
}

function resetGitPushUI() {
  if (gitPushPollTimer) { clearTimeout(gitPushPollTimer); gitPushPollTimer = null; }
  const btnPush = document.getElementById("btnPush");
  btnPush && (btnPush.disabled = false);
  const btnCancel = document.getElementById("btnCancelPush");
  btnCancel && btnCancel.classList.add("hidden");
}

async function checkSSHStatus() {
  appendTerminal("system", "正在检查 SSH 密钥认证...");
  try {
    const resp = await fetch("/api/git/check-ssh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: "github.com" }),
    });
    const data = await resp.json();
    if (data.ok) {
      appendTerminal("success", "SSH 连接成功: " + data.message);
      showToast("SSH 密钥认证成功", "success");
    } else {
      appendTerminal("error", "SSH 认证失败: " + data.message);
      showToast("SSH 认证失败，请检查密钥配置", "error");
    }
  } catch (e) {
    appendTerminal("error", "SSH 检查失败: " + e.message);
  }
}

async function pushToGitHub() {
  const config = getGitHubConfig();
  updatePublishRepoDisplay();

  if (!STATE.projectDir) { showToast("请先选择项目目录", "error"); return; }
  if (!config.remoteUrl) { showToast("请先在设置中配置仓库路径", "error"); return; }

  const projectName = STATE.projectDir.name || "";
  const modeLabel = config.remoteUrl.startsWith("git@") ? "SSH" : "HTTPS";
  appendTerminal("system", "正在通过 " + modeLabel + " 推送项目到 " + config.owner + "/" + config.repo + " (分支: " + config.branch + ")");

  const btnPush = document.getElementById("btnPush");
  btnPush && (btnPush.disabled = true);
  const btnCancel = document.getElementById("btnCancelPush");
  btnCancel && btnCancel.classList.remove("hidden");

  try {
    const resp = await fetch("/api/git/push/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: projectName,
        remoteUrl: config.remoteUrl,
        branch: config.branch,
        force: true,
      }),
    });
    const data = await resp.json();
    if (!data.ok) {
      appendTerminal("error", "推送启动失败: " + (data.error || "未知错误"));
      resetGitPushUI();
      showToast("推送启动失败", "error");
      return;
    }
    pollGitPushOutput();
  } catch (e) {
    appendTerminal("error", "推送请求失败: " + e.message);
    resetGitPushUI();
  }
}

function pollGitPushOutput() {
  if (gitPushPollTimer) clearTimeout(gitPushPollTimer);
  resetPollDedup("gitpush");
  (function poll() {
    fetch("/api/git/push/status").then(function(resp) {
      return resp.json();
    }).then(function(data) {
      const lines = data.output.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (pollDedup("gitpush", line)) continue;

        if (line.startsWith("[错误]") || line.startsWith("[ERR]")) {
          appendTerminal("error", line);
        } else if (line.startsWith("[系统]") && line.indexOf("✓") >= 0) {
          appendTerminal("success", line);
        } else if (line.startsWith("[系统]") && line.indexOf("✗") >= 0) {
          appendTerminal("error", line);
        } else if (line.startsWith("[系统]")) {
          appendTerminal("system", line);
        } else if (line.startsWith("[GIT]") && (line.indexOf("error") >= 0 || line.indexOf("fatal") >= 0 || line.indexOf("denied") >= 0)) {
          appendTerminal("error", line);
        } else if (line.startsWith("[GIT]")) {
          appendTerminal("info", line);
        } else {
          appendTerminal("info", line);
        }
      }

      if (data.running) {
        gitPushPollTimer = setTimeout(poll, 1500);
      } else {
        resetGitPushUI();
        if (data.succeeded === true) {
          appendTerminal("success", "推送完成！");
          showToast("推送成功", "success");
        } else if (data.succeeded === false) {
          appendTerminal("error", "推送失败，请查看上方错误信息");
          showToast("推送失败", "error");
        }
      }
    }).catch(function(e) {
      console.warn("Git push poll error:", e);
      gitPushPollTimer = setTimeout(poll, 2000);
    });
  })();
}

async function cancelGitPush() {
  try { await fetch("/api/git/push/cancel", { method: "POST" }); } catch(e) {
    console.warn("Failed to cancel git push:", e);
  }
  resetGitPushUI();
  appendTerminal("warn", "推送已取消");
  showToast("推送已取消", "info");
}

// ── Init on tab switch ──
function loadPublishState() {
  updatePublishRepoDisplay();
  restoreTerminal();
}
