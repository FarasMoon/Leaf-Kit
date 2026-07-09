// ============================================================
// UI.js — Aggregator entry point
// Imports all ui/ sub-modules and attaches exports to window
// for backward compatibility with global scripts.
// ============================================================
console.log("[UI.js] Module loading started");

// Side-effect imports (set up window globals, no exports needed)
import "./ui/image-cache.js";

// Re-export and attach to window
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

// ── Attach all exports to window for backward compatibility ──
Object.assign(window, {
  // Tree editor
  renderTreeEditor,
  createTreeNode,
  fieldLabel,
  buildFieldInput,
  buildAddRow,
  renderTreeNodes,
  markTreeDirty,
  // Image field
  resolveImageUrl,
  readProjectImageAsBlob,
  createThumbnail,
  showFullImage,
  renderImageField,
  triggerImageUpload,
  uploadImage,
  uploadMultipleImages,
  // Gallery
  loadGalleryImages,
  readUrlsTxt,
  // Config UI
  buildConfigUI,
  getSectionLabel,
  // Save
  syncJsonEditor,
  applyJsonFromEditor,
  copyJson,
  updateStatusDot,
  saveSingleConfig,
  saveAllConfig,
});
console.log("[UI.js] Module loaded, exports attached to window");
