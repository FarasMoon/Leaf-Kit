// ============================================================
// Init
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  loadSettingsData();
  loadPublishState();
  updatePlatformUI();
  showPlatformWatermark();
  // Try to reconnect saved project directory
  reconnectProject().catch(function () {});

  // Ctrl+S / Cmd+S keyboard shortcut
  document.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (STATE.currentPanel === "articles" && STATE.currentArticlePath) {
        saveArticle();
      } else if (STATE.currentPanel === "config" || STATE.currentPanel === "articles") {
        saveAllConfig();
      }
    }
  });

  // Warn before leaving with unsaved changes
  window.addEventListener("beforeunload", function(e) {
    if (STATE.modifiedConfigs && STATE.modifiedConfigs.size > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
});

// Load marked.js dynamically with offline fallback
(function loadMarked() {
  // Show preview loading indicator
  const preview = document.getElementById("articlePreview");
  if (preview) {
    preview.innerHTML =
      '<div class="loading-overlay"><span class="spinner"></span> Markdown 渲染引擎加载中...</div>';
  }

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
  script.onload = () => {
    if (typeof marked !== "undefined") {
      if (preview && preview.querySelector(".loading-overlay")) {
        preview.innerHTML = "";
      }
      updateArticlePreview();
    }
  };
  script.onerror = () => {
    console.warn("marked.js 加载失败，预览功能将不可用");
    if (preview) {
      preview.innerHTML =
        '<div class="loading-overlay" style="color:var(--warning)">marked.js 离线不可用，预览功能已禁用。请确保网络连接。</div>';
    }
  };
  document.head.appendChild(script);
})();
