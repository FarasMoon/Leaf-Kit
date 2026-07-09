// ============================================================
// Save logic — saveSingle/saveAll
// updateStatusDot and syncJsonEditor are imported from shared-ui.js
// to break circular dependencies.
// ============================================================

import { buildConfigTS } from "../builder.js";
import { updateStatusDot } from "./shared-ui.js";

// parser.js is loaded as a regular script — grab from window
const { getConfigValue, getNestedValue, setNestedValue } = window;

export function applyJsonFromEditor(configKey) {
  const editor = document.getElementById("json-editor-" + configKey);
  try {
    const parsed = JSON.parse(editor.value);
    STATE.configs[configKey] = parsed;
    STATE.modifiedConfigs.add(configKey);
    updateStatusDot();
    // buildConfigUI is resolved at call time via window (set by UI.js)
    window.buildConfigUI();
    showToast(
      `${getCurrentSchema()[configKey].label} 已从JSON更新`,
      "success",
    );
  } catch (e) {
    showToast("JSON解析错误: " + e.message, "error");
  }
}

export function copyJson(configKey) {
  const editor = document.getElementById("json-editor-" + configKey);
  navigator.clipboard.writeText(editor.value).then(() => {
    showToast("已复制到剪贴板", "success");
  });
}

export async function saveSingleConfig(configKey) {
  if (!STATE.projectDir) {
    showToast("请先选择项目目录", "error");
    return;
  }
  try {
    const schema = getCurrentSchema()[configKey];
    const data = STATE.configs[configKey];
    const newContent = buildConfigTS(configKey, data);
    console.log(
      "[Save] " +
        configKey +
        " -> " +
        schema.file +
        " (" +
        newContent.length +
        " bytes)",
    );
    await writeTextFile(schema.file, newContent);
    STATE.modifiedConfigs.delete(configKey);
    // Single-file platforms (Fuwari-like): all configs share one file
    if (getPlatformLayout() === "single") {
      for (const k in getCurrentSchema()) {
        STATE.modifiedConfigs.delete(k);
      }
    }
    updateStatusDot();
    showToast(`${schema.label} 已保存`, "success");
  } catch (e) {
    console.error("[Save] " + configKey + " FAILED:", e);
    showToast(`保存失败: ${e.message}`, "error");
  }
}

export async function saveAllConfig() {
  if (!STATE.projectDir) {
    showToast("请先选择项目目录", "error");
    return;
  }
  if (STATE.modifiedConfigs.size === 0) {
    showToast("没有需要保存的修改", "info");
    return;
  }
  // ── Single-file platforms: all configs in one file, save once ──
  if (getPlatformLayout() === "single") {
    try {
      // Pick any modified config key as entry point
      const anyKey = Array.from(STATE.modifiedConfigs)[0];
      await saveSingleConfig(anyKey);
      // Clear all configs from modified set since they were all saved
      for (const k in getCurrentSchema()) {
        STATE.modifiedConfigs.delete(k);
      }
      updateStatusDot();
      showToast("已保存全部配置到 " + (getCurrentSchema()._meta && getCurrentSchema()._meta.outputFile || "src/config.ts"), "success");
    } catch (e) {
      console.error("[Save] single-file save failed:", e);
      showToast("保存失败: " + (e && e.message || e), "error");
    }
    return;
  }
  const keys = Array.from(STATE.modifiedConfigs);
  let saved = 0,
    failed = 0;
  for (const key of keys) {
    try {
      await saveSingleConfig(key);
      saved++;
    } catch (e) {
      failed++;
    }
  }
  updateStatusDot();
  showToast(
    `已保存 ${saved} 项配置${failed > 0 ? `，${failed} 项失败` : ""}`,
    failed > 0 ? "warning" : "success",
  );
}
