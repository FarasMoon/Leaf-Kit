// ============================================================
// Image Field — preview + upload + replace + thumbnail
// ============================================================

// parser.js is loaded as a regular script — grab from window
const { setNestedValue } = window;
import { uploadImage } from "./upload.js";
import { updateStatusDot, syncJsonEditor } from "./shared-ui.js";

// ── Image blob cache (accessed by filesystem.js as globals) ──
// Cache setup is in image-cache.js (imported for side effects)

export function resolveImageUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  if (/^blob:/.test(path)) return path;
  const clean = path.replace(/^\/+/, "");
  return "/" + clean;
}

export async function readProjectImageAsBlob(relativePath) {
  if (!STATE.projectDir) return null;
  const cached = window._imgBlobCacheGet(relativePath);
  if (cached) return cached;
  async function tryRead(path) {
    const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = clean.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const fileName = parts.pop();
    let handle = STATE.projectDir;
    let cacheKey = "";
    for (let i = 0; i < parts.length; i++) {
      cacheKey += "/" + parts[i];
      if (!window._dirHandleCache[cacheKey]) {
        window._dirHandleCache[cacheKey] = await handle.getDirectoryHandle(parts[i], { create: false });
      }
      handle = window._dirHandleCache[cacheKey];
    }
    const fileHandle = await handle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    window._imgBlobCacheSet(relativePath, blobUrl);
    return blobUrl;
  }
  try {
    return await tryRead(relativePath);
  } catch (e) {
    try {
      return await tryRead("src/" + relativePath.replace(/^\/+/, ""));
    } catch (e2) {
      try {
        return await tryRead("public/" + relativePath.replace(/^\/+/, ""));
      } catch (e3) {
        return null;
      }
    }
  }
}

export async function createThumbnail(blobUrl, maxWidth) {
  maxWidth = maxWidth || 360;
  return new Promise(function (resolve) {
    const cached = window._thumbCacheGet(blobUrl);
    if (cached) { resolve(cached); return; }
    const thumbImg = new Image();
    thumbImg.onload = function () {
      const w = this.naturalWidth, h = this.naturalHeight;
      if (w <= maxWidth) { window._thumbCacheSet(blobUrl, blobUrl); resolve(blobUrl); return; }
      const ratio = maxWidth / w;
      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round(h * ratio);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        if (blob) {
          const tUrl = URL.createObjectURL(blob);
          window._thumbCacheSet(blobUrl, tUrl);
          resolve(tUrl);
        } else {
          window._thumbCacheSet(blobUrl, blobUrl);
          resolve(blobUrl);
        }
      }, "image/jpeg", 0.6);
    };
    thumbImg.onerror = function () { resolve(blobUrl); };
    thumbImg.src = blobUrl;
  });
}

export function showFullImage(blobUrl, path) {
  const overlay = document.createElement("div");
  overlay.className = "full-image-overlay";
  const img = document.createElement("img");
  img.src = blobUrl;
  img.className = "full-image-img";
  const pathLabel = document.createElement("div");
  pathLabel.className = "full-image-path";
  pathLabel.textContent = path;
  overlay.appendChild(img);
  overlay.appendChild(pathLabel);
  overlay.onclick = function () { overlay.remove(); };
  document.body.appendChild(overlay);
}

export function renderImageField(configKey, field, currentPath, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  // Preview
  const preview = document.createElement("div");
  preview.className = "img-preview";
  if (currentPath) {
    const img = document.createElement("img");
    img.src = resolveImageUrl(currentPath);
    img.alt = field.label;
    img.onerror = async function () {
      let blobUrl = await readProjectImageAsBlob(currentPath);
      if (blobUrl) {
        this.src = blobUrl;
        return;
      }
      if (currentPath.indexOf("/") === 0) {
        blobUrl = await readProjectImageAsBlob(currentPath.substring(1));
        if (blobUrl) {
          this.src = blobUrl;
          return;
        }
      }
      this.style.display = "none";
      preview.innerHTML = '<span class="img-placeholder">?</span>';
    };
    (async function () {
      if (!/^https?:\/\//.test(currentPath) && !/^blob:/.test(currentPath)) {
        const blobUrl = await readProjectImageAsBlob(currentPath);
        if (blobUrl) {
          img.src = blobUrl;
        }
      }
    })();
    preview.appendChild(img);
    // Overlay actions
    const overlay = document.createElement("div");
    overlay.className = "img-actions-overlay";
    const repBtn = document.createElement("button");
    repBtn.textContent = "替换";
    repBtn.onclick = function (e) {
      e.stopPropagation();
      triggerImageUpload(configKey, field, containerId);
    };
    overlay.appendChild(repBtn);
    const delBtn2 = document.createElement("button");
    delBtn2.textContent = "删除";
    delBtn2.onclick = function (e) {
      e.stopPropagation();
      setNestedValue(STATE.configs[configKey], field.key, "");
      STATE.modifiedConfigs.add(configKey);
      updateStatusDot();
      syncJsonEditor(configKey);
      renderImageField(configKey, field, "", containerId);
    };
    overlay.appendChild(delBtn2);
    preview.appendChild(overlay);
  } else {
    preview.innerHTML = '<span class="img-placeholder">+</span>';
  }
  preview.onclick = function () {
    triggerImageUpload(configKey, field, containerId);
  };
  container.appendChild(preview);

  // Info area
  const info = document.createElement("div");
  info.className = "img-upload-info";
  const pathInput = document.createElement("input");
  pathInput.type = "text";
  pathInput.value = currentPath;
  pathInput.placeholder = "图片路径，如 /images/avatar.jpg";
  pathInput.oninput = function () {
    const v = this.value;
    setNestedValue(STATE.configs[configKey], field.key, v);
    STATE.modifiedConfigs.add(configKey);
    updateStatusDot();
    syncJsonEditor(configKey);
  };
  pathInput.onchange = function () {
    renderImageField(configKey, field, this.value, containerId);
  };
  info.appendChild(pathInput);
  const btns = document.createElement("div");
  btns.className = "img-upload-btns";
  const upBtn = document.createElement("button");
  upBtn.className = "btn btn-secondary";
  upBtn.textContent = "上传图片";
  upBtn.onclick = function () {
    triggerImageUpload(configKey, field, containerId);
  };
  btns.appendChild(upBtn);
  if (currentPath) {
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-secondary";
    delBtn.textContent = "清除";
    delBtn.style.color = "var(--danger)";
    delBtn.onclick = function () {
      setNestedValue(STATE.configs[configKey], field.key, "");
      STATE.modifiedConfigs.add(configKey);
      updateStatusDot();
      syncJsonEditor(configKey);
      renderImageField(configKey, field, "", containerId);
    };
    btns.appendChild(delBtn);
  }
  info.appendChild(btns);
  container.appendChild(info);
}

export function triggerImageUpload(configKey, field, containerId) {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.onchange = function () {
    const file = this.files[0];
    if (!file) return;
    const uploadDir = field.uploadDir || "public/images";
    uploadImage(file, uploadDir).then(function (relPath) {
      setNestedValue(STATE.configs[configKey], field.key, relPath);
      STATE.modifiedConfigs.add(configKey);
      updateStatusDot();
      syncJsonEditor(configKey);
      renderImageField(configKey, field, relPath, containerId);
    }).catch(function () {
      // Fallback: use blob URL locally
      const url = URL.createObjectURL(file);
      setNestedValue(STATE.configs[configKey], field.key, url);
      STATE.modifiedConfigs.add(configKey);
      updateStatusDot();
      syncJsonEditor(configKey);
      renderImageField(configKey, field, url, containerId);
    });
  };
  inp.click();
}
