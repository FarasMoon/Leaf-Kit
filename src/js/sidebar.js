// ============================================================
// 侧边栏和面板切换
// ============================================================

function updateDocLinks(platform) {
  const docs = (PLATFORMS[platform] && PLATFORMS[platform].docs) || {};
  const linkEl = document.getElementById("linkGettingStarted");
  if (linkEl && docs._getting_started) {
    linkEl.href = docs._getting_started;
  }
}

function getDocUrl(configKey) {
  const platform = typeof getCurrentPlatform === "function" ? getCurrentPlatform() : "firefly";
  const docs = (PLATFORMS[platform] && PLATFORMS[platform].docs) || {};
  return docs[configKey] || null;
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

function switchPanel(panel) {
  STATE.currentPanel = panel;
  document
    .querySelectorAll(".nav-item:not(.nav-accordion)")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector(`.nav-item:not(.nav-accordion)[data-panel="${panel}"]`)
    ?.classList.add("active");
  document
    .querySelectorAll(".content-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById("panel-" + panel).classList.add("active");
  if (panel === "articles") loadArticles();
  if (panel === "publish") { loadPublishState(); loadSettingsData(); }
}

function toggleNavAccordion(btn) {
  const body = btn.nextElementSibling;
  const isCollapsed = btn.classList.toggle("collapsed");
  body.classList.toggle("collapsed", isCollapsed);
  if (!isCollapsed) switchPanel("config");
}

function toggleCardBody(header) {
  header.classList.toggle("collapsed");
  header.nextElementSibling.classList.toggle("collapsed");
}

function clearCacheAndReload() {
  window.location.href = window.location.pathname + '?t=' + Date.now();
}
