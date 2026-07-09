// ============================================================
// Wallpaper Image Management (desktop + mobile)
// ============================================================

import { updateStatusDot, syncJsonEditor } from "./shared-ui.js";
import { readProjectImageAsBlob, createThumbnail, showFullImage } from "./image-preview.js";
import { uploadMultipleImages } from "./upload.js";

export function buildWallpaperSection(label, targetArray, uploadDir, key, rebuildFn) {
  const section = document.createElement("div");
  section.className = "form-section";
  section.style.marginTop = "12px";

  const headerRow = document.createElement("div");
  headerRow.className = "section-header-row";
  const secLabel = document.createElement("span");
  secLabel.className = "form-section-label";
  secLabel.textContent = label + " (" + targetArray.length + " 张)";
  headerRow.appendChild(secLabel);
  const upBtn = document.createElement("button");
  upBtn.className = "btn btn-primary btn-sm";
  upBtn.textContent = "上传";
  upBtn.onclick = function () {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.multiple = true;
    inp.onchange = function () {
      const files = this.files;
      if (!files || files.length === 0) return;
      uploadMultipleImages(Array.from(files), uploadDir).then(function (paths) {
        if (paths.length > 0) {
          for (const p of paths) {
            if (targetArray.indexOf(p) === -1) targetArray.push(p);
          }
          STATE.modifiedConfigs.add(key);
          updateStatusDot();
          syncJsonEditor(key);
          rebuildFn();
          showToast("已上传 " + paths.length + " 张壁纸图片到" + label, "success");
        }
      });
    };
    inp.click();
  };
  headerRow.appendChild(upBtn);
  section.appendChild(headerRow);

  // Image grid
  const grid = document.createElement("div");
  grid.className = "image-list-grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";

  const loadQueue = [];
  targetArray.forEach(function (imgPath, idx) {
    const item = document.createElement("div");
    item.className = "image-list-item";

    const img = document.createElement("img");
    img.alt = "壁纸 " + (idx + 1);
    img.loading = "lazy";
    if (/^https?:\/\//.test(imgPath) || /^blob:/.test(imgPath)) {
      img.src = imgPath;
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "image-list-placeholder";
      placeholder.textContent = "...";
      item.appendChild(placeholder);
      loadQueue.push({ img: img, placeholder: placeholder, path: imgPath, item: item });
    }
    img.onerror = function () {
      this.style.display = "none";
    };
    item.appendChild(img);

    const pathLabel = document.createElement("div");
    pathLabel.className = "wallpaper-path-label";
    pathLabel.textContent = imgPath;
    item.appendChild(pathLabel);

    const overlay = document.createElement("div");
    overlay.className = "image-list-overlay";

    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.onclick = function (e) {
      e.stopPropagation();
      targetArray.splice(idx, 1);
      STATE.modifiedConfigs.add(key);
      updateStatusDot();
      syncJsonEditor(key);
      rebuildFn();
    };
    overlay.appendChild(delBtn);
    item.appendChild(overlay);
    grid.appendChild(item);
  });

  // Staggered loading: create thumbnails, click for full
  if (loadQueue.length > 0) {
    const batchSize = 2;
    const delay = 100;
    function loadBatch(startIdx) {
      const end = Math.min(startIdx + batchSize, loadQueue.length);
      for (let i = startIdx; i < end; i++) {
        (function (entry) {
          readProjectImageAsBlob(entry.path).then(function (blobUrl) {
            if (blobUrl) {
              entry.item._fullBlobUrl = blobUrl;
              createThumbnail(blobUrl, 360).then(function (thumbUrl) {
                entry.img.src = thumbUrl;
                entry.placeholder.remove();
                entry.item.style.cursor = "zoom-in";
                entry.item.title = "点击查看原图";
                entry.item.onclick = function (e) {
                  if (e.target.tagName === "BUTTON") return;
                  showFullImage(entry.item._fullBlobUrl, entry.path);
                };
              });
            } else {
              entry.placeholder.textContent = "?";
            }
          });
        })(loadQueue[i]);
      }
      if (end < loadQueue.length) {
        setTimeout(function () { loadBatch(end); }, delay);
      }
    }
    setTimeout(function () { loadBatch(0); }, 50);
  }

  if (targetArray.length === 0) {
    const empty = document.createElement("div");
    empty.className = "wallpaper-empty";
    empty.textContent = '暂无壁纸，点击"上传"按钮添加';
    grid.appendChild(empty);
  }

  section.appendChild(grid);
  return section;
}
