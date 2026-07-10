// ============================================================
// 保存逻辑 — saveSingle/saveAll
// updateStatusDot 和 syncJsonEditor 从 shared-ui.js 导入
// 以打破循环依赖。
// ============================================================

import { buildConfigTS } from "../builder.js";
import { updateStatusDot } from "./shared-ui.js";

// parser.js 作为常规脚本加载 — 从 window 获取
const { getConfigValue, getNestedValue, setNestedValue } = window;

export function applyJsonFromEditor(configKey) {
  const editor = document.getElementById("json-editor-" + configKey);
  try {
    const parsed = JSON.parse(editor.value);
    STATE.configs[configKey] = parsed;
    STATE.modifiedConfigs.add(configKey);
    updateStatusDot();
    // buildConfigUI 通过 window 在调用时解析（由 UI.js 设置）
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
    // 单文件平台（如 Fuwari）：所有配置共享一个文件
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
  // ── 单文件平台：所有配置在一个文件中，只保存一次 ──
  if (getPlatformLayout() === "single") {
    try {
      // 选择任意一个已修改的配置键作为入口
      const anyKey = Array.from(STATE.modifiedConfigs)[0];
      await saveSingleConfig(anyKey);
      // 清除所有已保存配置的修改标记
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
