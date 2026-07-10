// ============================================================
// 相册图片管理
// ============================================================

import { uploadMultipleImages } from "./upload.js";
import { createThumbnail, showFullImage, readProjectImageAsBlob } from "./image-preview.js";

const IMG_EXTS = /\.(jpg|jpeg|png|webp|avif|gif|svg|bmp)$/i;

export function loadGalleryImages(albumId, grid) {
  const dirPath = "public/gallery/" + albumId;

  // 如果 grid 是 gallery-album-images 区域，完全重建它
  let section = grid.closest ? grid.closest(".gallery-album-images") : null;
  if (!section) section = grid;

  // 重建头部和网格结构
  section.innerHTML = "";
  const header = document.createElement("div");
  header.className = "gallery-album-header";
  header.innerHTML = '<span class="gallery-album-title">照片: ' + escapeHtml(albumId) + '</span>';
  section.appendChild(header);

  const imageGrid = document.createElement("div");
  imageGrid.className = "image-list-grid";
  imageGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
  section.appendChild(imageGrid);

  // 上传按钮
  const upBtn = document.createElement("button");
  upBtn.className = "btn btn-primary btn-sm";
  upBtn.textContent = "上传图片到此相册";
  upBtn.style.marginBottom = "8px";
  upBtn.onclick = function () {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.multiple = true;
    inp.onchange = function () {
      const files = this.files;
      if (!files || files.length === 0) return;
      const uploadDir = "public/gallery/" + albumId;
      uploadMultipleImages(Array.from(files), uploadDir).then(function (paths) {
        if (paths.length > 0) {
          showToast("已上传 " + paths.length + " 张照片到 " + albumId, "success");
          loadGalleryImages(albumId, imageGrid);
        }
      });
    };
    inp.click();
  };
  header.appendChild(upBtn);

  const listFn = typeof listDirMerged === "function" ? listDirMerged : listDir;
  listFn(dirPath).then(function (entries) {
    const localFiles = entries.filter(function (e) {
      return e.kind === "file" && IMG_EXTS.test(e.name);
    });

    // 同时从 urls.txt 读取远程 URL
    readUrlsTxt(dirPath).then(function (remoteUrls) {
      renderImageList(localFiles, remoteUrls);
    }).catch(function () {
      renderImageList(localFiles, []);
    });
  }).catch(function (err) {
    console.warn("[Gallery] 无法读取相册目录: " + albumId, err && err.message || err);
    // 尝试服务端列表作为回退
    if (typeof listDirServer === "function") {
      listDirServer(dirPath).then(function (entries) {
        const localFiles = entries.filter(function (e) {
          return e.kind === "file" && IMG_EXTS.test(e.name);
        });
        readUrlsTxt(dirPath).then(function (remoteUrls) {
          renderImageList(localFiles, remoteUrls);
        }).catch(function () {
          renderImageList(localFiles, []);
        });
      }).catch(function () {
        showEmptyState("无法读取目录 (可能尚未创建)");
      });
    } else {
      showEmptyState("无法读取目录 (可能尚未创建)");
    }
  });

  function showEmptyState(msg) {
    imageGrid.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "wallpaper-empty";
    empty.textContent = msg;
    imageGrid.appendChild(empty);
  }

  function renderImageList(localFiles, remoteUrls) {
    imageGrid.innerHTML = "";
    const totalItems = localFiles.length + remoteUrls.length;
    if (totalItems === 0) {
      const empty = document.createElement("div");
      empty.className = "wallpaper-empty";
      empty.textContent = "暂无照片";
      imageGrid.appendChild(empty);
      return;
    }

    // 更新头部计数
    const titleEl = header.querySelector(".gallery-album-title");
    if (titleEl) {
      titleEl.textContent = "照片: " + escapeHtml(albumId) + " (" + totalItems + " 张)";
    }

    // 渲染本地文件（含缩略图）
    localFiles.forEach(function (fileEntry) {
      const fullPath = "/" + dirPath.replace(/\\/g, "/") + "/" + fileEntry.name;
      const item = createImageItem(fileEntry.name, null, fullPath, true, dirPath, albumId);
      imageGrid.appendChild(item);
    });

    // 直接渲染远程 URL
    remoteUrls.forEach(function (url) {
      const urlName = url.split("/").pop() || url;
      const item = createImageItem(urlName, url, url, false, dirPath, albumId);
      imageGrid.appendChild(item);
    });
  }

  function createImageItem(name, directSrc, fullPath, isLocal, dirPath, albumId) {
    const item = document.createElement("div");
    item.className = "image-list-item";

    const img = document.createElement("img");
    img.alt = name;
    img.loading = "lazy";

    const placeholder = document.createElement("div");
    placeholder.className = "image-list-placeholder";
    placeholder.textContent = "...";
    item.appendChild(placeholder);

    if (directSrc && !isLocal) {
      // 远程 URL：直接使用
      img.src = directSrc;
      placeholder.remove();
      item.style.cursor = "zoom-in";
      item.title = "点击查看原图";
      item.onclick = function (e) {
        if (e.target.tagName === "BUTTON") return;
        showFullImage(directSrc, directSrc);
      };
    } else {
      // 本地文件：作为 blob 读取并创建缩略图
      readProjectImageAsBlob(fullPath).then(function (blobUrl) {
        if (blobUrl) {
          createThumbnail(blobUrl, 280).then(function (thumbUrl) {
            img.src = thumbUrl;
            placeholder.remove();
            item.style.cursor = "zoom-in";
            item.title = "点击查看原图";
            item.onclick = function (e) {
              if (e.target.tagName === "BUTTON") return;
              showFullImage(blobUrl, fullPath);
            };
          });
        } else {
          placeholder.textContent = "?";
        }
      });
    }

    img.onerror = function () {
      this.style.display = "none";
      if (placeholder.parentNode) placeholder.textContent = "!";
    };
    item.appendChild(img);

    const pathLabel = document.createElement("div");
    pathLabel.className = "wallpaper-path-label";
    pathLabel.textContent = name;
    item.appendChild(pathLabel);

    const overlay = document.createElement("div");
    overlay.className = "image-list-overlay";

    if (isLocal) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "删除";
      delBtn.onclick = function (e) {
        e.stopPropagation();
        if (confirm("确定要删除 " + name + " 吗？")) {
          deleteFile(fullPath).then(function () {
            showToast("已删除 " + name, "info");
            loadGalleryImages(albumId, imageGrid);
          }).catch(function (err) {
            showToast("删除失败: " + (err && err.message || err), "error");
          });
        }
      };
      overlay.appendChild(delBtn);
    } else {
      const remoteLabel = document.createElement("span");
      remoteLabel.className = "gallery-remote-badge";
      remoteLabel.textContent = "远程";
      remoteLabel.style.cssText = "font-size:10px;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px";
      overlay.appendChild(remoteLabel);
    }
    item.appendChild(overlay);
    return item;
  }
}

// 从相册目录读取 urls.txt 并返回远程 URL
export function readUrlsTxt(dirPath) {
  return new Promise(function (resolve, reject) {
    const txtPath = dirPath.replace(/\\/g, "/") + "/urls.txt";
    try {
      readTextFile(txtPath).then(function (content) {
        const urls = content.split("\n")
          .map(function (line) { return line.trim(); })
          .filter(function (line) { return line && !line.startsWith("#") && /^https?:\/\//.test(line); });
        resolve(urls);
      }).catch(function () {
        resolve([]);
      });
    } catch (e) {
      resolve([]);
    }
  });
}
