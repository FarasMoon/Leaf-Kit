// ============================================================
// Settings
// ============================================================
function loadSettingsData() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("MizukiUI_Settings") || "{}",
    );
    const theme = saved.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
    const themeRadio = document.querySelector(
      `input[name="settingTheme"][value="${theme}"]`,
    );
    if (themeRadio) themeRadio.checked = true;
    const gitRepo = document.getElementById("settingGitRepo");
    if (gitRepo) gitRepo.value = saved.gitRepo || "";
    const gitRemote = document.getElementById("settingGitRemote");
    if (gitRemote) gitRemote.value = saved.gitRemote || "";
    const gitBranch = document.getElementById("settingGitBranch");
    if (gitBranch) gitBranch.value = saved.gitBranch || "gh-pages";
    // Auto detect toggle
    const autoDetect = document.getElementById("settingAutoDetect");
    if (autoDetect) autoDetect.checked = STATE.platform === "auto";
    // Admin accent
    const accent = saved.adminAccent || "#2080d0";
    const accentEl = document.getElementById("settingAccent");
    if (accentEl) accentEl.value = accent;
    const accentHex = document.getElementById("settingAccentHex");
    if (accentHex) accentHex.value = accent;
    const accentDemo = document.getElementById("accentDemo");
    if (accentDemo) accentDemo.style.background = accent;
    // Custom accent toggle
    const customAccent = saved.customAccent !== false; // default true (custom ON)
    const customAccentEl = document.getElementById("settingCustomAccent");
    if (customAccentEl) customAccentEl.checked = customAccent;
    toggleAccentLock(!customAccent);
    if (!customAccent) {
      applyAdminAccent(getPlatformAccent());
    } else {
      applyAdminAccent(accent);
    }
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
}

function onAutoDetectChange(checked) {
  if (checked) {
    STATE.platform = "auto";
  } else {
    // Default to current effective platform
    STATE.platform = getCurrentPlatform();
  }
  updatePlatformUI();
  showPlatformWatermark();
  if (STATE.projectDir) {
    STATE.configs = {};
    STATE.modifiedConfigs.clear();
    loadAllConfigs().then(function() {
      buildConfigUI();
      loadArticles();
      updateStatusDot();
    });
    const nameMap = { firefly: "Firefly", mizuki: "Mizuki", fuwari: "Fuwari" };
    const name = nameMap[getCurrentPlatform()] || getCurrentPlatform();
    showToast("已切换到: " + (checked ? "自动检测 (" + name + ")" : name), "info");
  }
}

function applySettingTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || "light");
}

function applyAdminAccent(hex) {
  if (!hex) hex = "#2080d0";
  // Set accent color variables — transition handled by @property
  document.documentElement.style.setProperty("--accent", hex);
  // Compute dim accent (lightened version)
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  let h, s, l;
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  h = Math.round(h); s = Math.round(s * 100); l = Math.round(l * 100);
  document.documentElement.style.setProperty("--accent-h", h);
  document.documentElement.style.setProperty("--accent-s", s + "%");
  document.documentElement.style.setProperty("--accent-l", l + "%");
  document.documentElement.style.setProperty("--accent-dim", "hsl(" + h + " " + s + "% 90%)");
  document.documentElement.style.setProperty("--accent-glow", "hsl(" + h + " " + s + "% " + l + "% / 0.1)");
}

function toggleAccentLock(locked) {
  const color = document.getElementById("settingAccent");
  const hex = document.getElementById("settingAccentHex");
  if (color) { color.disabled = locked; color.style.opacity = locked ? "0.4" : "1"; }
  if (hex) { hex.disabled = locked; hex.style.opacity = locked ? "0.4" : "1"; }
}

function saveSettings() {
  const accent =
    document.getElementById("settingAccent").value || "#2080d0";
  const customAccent = document.getElementById("settingCustomAccent").checked;
  const settings = {
    theme:
      document.querySelector('input[name="settingTheme"]:checked')
        ?.value || "light",
    gitRepo:
      document.getElementById("settingGitRepo").value || "",
    gitRemote: document.getElementById("settingGitRemote").value,
    gitBranch: document.getElementById("settingGitBranch").value || "gh-pages",
    adminAccent: accent,
    customAccent: customAccent,
  };
  localStorage.setItem("MizukiUI_Settings", JSON.stringify(settings));
  applySettingTheme(settings.theme);
  if (customAccent) {
    applyAdminAccent(settings.adminAccent);
  } else {
    applyAdminAccent(getPlatformAccent());
  }
  // Sync repo owner/name to old localStorage keys for backward compat
  const parts = settings.gitRepo.split("/");
  if (parts[0]) localStorage.setItem("gh_owner", parts[0]);
  if (parts[1]) localStorage.setItem("gh_repo", parts[1]);
  localStorage.setItem("gh_branch", settings.gitBranch);
  // Update publish panel repo display
  if (typeof updatePublishRepoDisplay === "function") updatePublishRepoDisplay();
  showToast("设置已保存", "success");
}

async function testSSHFromSettings() {
  const resultEl = document.getElementById("settingGitTestResult");
  resultEl.innerHTML =
    '<span style="color:var(--text2)">正在检测 SSH 连接...</span>';
  try {
    const resp = await fetch("/api/git/check-ssh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: "github.com" }),
    });
    const data = await resp.json();
    if (data.ok) {
      resultEl.innerHTML =
        '<span style="color:var(--success)">SSH 连接成功</span>';
    } else {
      resultEl.innerHTML =
        '<span style="color:var(--danger)">SSH 认证失败: ' + (data.message || "请检查密钥配置") + '</span>';
    }
  } catch (e) {
    resultEl.innerHTML = '<span style="color:var(--danger)">网络错误</span>';
  }
}
