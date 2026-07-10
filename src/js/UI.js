// ============================================================
// UI.js — 聚合入口文件
// 导入所有 ui/ 子模块并将导出挂载到 window
// 以便全局脚本向后兼容。
// ============================================================
console.log("[UI.js] Module loading started");

// 副作用导入（设置 window 全局变量，无需导出）
import "./ui/image-cache.js";

// 重新导出并挂载到 window
import { uploadImage, uploadMultipleImages } from "./ui/upload.js";
import { loadGalleryImages, readUrlsTxt } from "./ui/gallery.js";
import {
  renderTreeEditor,
  createTreeNode,
  fieldLabel,
  buildFieldInput,
  buildAddRow,
  renderTreeNodes,
  markTreeDirty,
} from "./ui/tree-editor.js";
import {
  resolveImageUrl,
  readProjectImageAsBlob,
  createThumbnail,
  showFullImage,
  renderImageField,
  triggerImageUpload,
} from "./ui/image-preview.js";
import { buildConfigUI, getSectionLabel } from "./ui/config-cards.js";
import {
  applyJsonFromEditor,
  copyJson,
  saveSingleConfig,
  saveAllConfig,
} from "./ui/save.js";
import { syncJsonEditor, updateStatusDot } from "./ui/shared-ui.js";

// ── 将所有导出挂载到 window 以保证向后兼容 ──
Object.assign(window, {
  // 树形编辑器
  renderTreeEditor,
  createTreeNode,
  fieldLabel,
  buildFieldInput,
  buildAddRow,
  renderTreeNodes,
  markTreeDirty,
  // 图片字段
  resolveImageUrl,
  readProjectImageAsBlob,
  createThumbnail,
  showFullImage,
  renderImageField,
  triggerImageUpload,
  uploadImage,
  uploadMultipleImages,
  // 相册
  loadGalleryImages,
  readUrlsTxt,
  // 配置界面
  buildConfigUI,
  getSectionLabel,
  // 保存
  syncJsonEditor,
  applyJsonFromEditor,
  copyJson,
  updateStatusDot,
  saveSingleConfig,
  saveAllConfig,
});
console.log("[UI.js] Module loaded, exports attached to window");
