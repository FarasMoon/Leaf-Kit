// ============================================================
// Shared UI utilities — status dot, JSON editor sync
// Extracted to break circular dependencies between save.js ↔
// config-cards.js ↔ tree-editor.js ↔ image-preview.js ↔ wallpaper.js
// ============================================================

// Debounced syncJsonEditor — avoids expensive JSON.stringify on every keystroke
let _syncJsonTimers = {};

export function syncJsonEditor(configKey) {
  if (!_syncJsonTimers[configKey]) {
    _syncJsonTimers[configKey] = setTimeout(function () {
      _syncJsonTimers[configKey] = null;
      const editor = document.getElementById("json-editor-" + configKey);
      if (!editor || editor === document.activeElement) return;
      const data = STATE.configs[configKey];
      editor.value = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    }, 250);
  }
}

export function updateStatusDot() {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  if (STATE.modifiedConfigs.size > 0) {
    dot.className = "status-dot unsaved";
    text.textContent = `${STATE.modifiedConfigs.size} 项已修改`;
  } else {
    dot.className = "status-dot saved";
    text.textContent = "已保存";
    setTimeout(() => {
      dot.className = "status-dot";
      text.textContent = "就绪";
    }, 3000);
  }
}
