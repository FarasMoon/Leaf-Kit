// ============================================================
// Schema 构建辅助函数 — 字段和配置工厂函数
// ============================================================
// 共享工具函数，减少 Schema 定义中的重复代码。
// 每个 Schema 文件（firefly.js, mizuki.js, fuwari.js）使用
// 这些工厂函数来构建其配置对象。

// ── 字段工厂函数 (F) ──
const F = {
  /** 文本输入 */
  txt(key, label, opts) { return { key, label, type: "text", ...opts }; },
  /** 多行文本域 */
  area(key, label, opts) { return { key, label, type: "textarea", ...opts }; },
  /** 数字输入（支持通过 opts 设置 min/max/step） */
  num(key, label, opts) { return { key, label, type: "number", ...opts }; },
  /** 复选框 / 布尔开关 */
  chk(key, label, opts) { return { key, label, type: "checkbox", ...opts }; },
  /** 下拉选择（options 为必填） */
  sel(key, label, options, opts) { return { key, label, type: "select", options, ...opts }; },
  /** 范围滑块 */
  range(key, label, min, max, opts) { return { key, label, type: "range", min, max, ...opts }; },
  /** 日期选择器 */
  date(key, label, opts) { return { key, label, type: "date", ...opts }; },
  /** 图片上传字段 */
  img(key, label, uploadDir, opts) { return { key, label, type: "image", uploadDir, ...opts }; },
};

// ── 数组字段工厂函数 (A) ──
function A(rootKey, label, nodeFields, opts) {
  return { rootKey, label, nodeFields, ...opts };
}

// ── 配置对象工厂函数 (C) ──
function C(file, desc, label, fields) {
  return { file, desc, label, fields };
}

/** 带 arrayFields 的配置（例如 profileConfig.links, galleryConfig.albums） */
function CA(file, desc, label, fields, arrayFields) {
  return { file, desc, label, fields, arrayFields };
}

/** 带 arrayFieldsList 的配置（例如 sidebar 的多组列表） */
function CAL(file, desc, label, fields, arrayFieldsList) {
  return { file, desc, label, fields, arrayFieldsList };
}

/** 带 splitExports 的配置（例如 Firefly 的 pioConfig） */
function CS(file, desc, label, fields, opts) {
  return { file, desc, label, fields, ...opts };
}
