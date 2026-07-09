// ============================================================
// File System Operations
// ============================================================
async function selectProjectDir() {
  try {
    const handle = await window.showDirectoryPicker({
      mode: "readwrite",
    });
    await setProjectHandle(handle);
  } catch (e) {
    if (e.name !== "AbortError")
      showToast("选择目录失败: " + e.message, "error");
  }
}

async function setProjectHandle(handle) {
  STATE.projectDir = handle;
  // Clear image caches for new project — revoke blob URLs
  if (typeof _imgBlobCache !== "undefined") {
    for (const k in _imgBlobCache) {
      const v = _imgBlobCache[k];
      if (typeof v === "string" && v.startsWith("blob:")) URL.revokeObjectURL(v);
    }
    _imgBlobCache = {};
  }
  if (typeof _thumbCache !== "undefined") {
    for (const k in _thumbCache) {
      const tv = _thumbCache[k];
      if (typeof tv === "string" && tv.startsWith("blob:") && tv !== k) URL.revokeObjectURL(tv);
    }
    _thumbCache = {};
  }
  if (typeof _dirHandleCache !== "undefined") _dirHandleCache = {};
  // Reset LRU tracking keys
  if (typeof _cacheKeys !== "undefined") { _cacheKeys.img = []; _cacheKeys.thumb = []; }
  document.getElementById("btnSaveAll").disabled = false;
  document.getElementById("btnRefresh").style.display = "";
  document.getElementById("btnPreviewToggle").disabled = false;
  document.getElementById("btnPush").disabled = false;
  saveDirHandle(handle);
  // Respect auto-detect setting: re-detect platform for new project
  const autoDetectEl = document.getElementById("settingAutoDetect");
  if (autoDetectEl && autoDetectEl.checked) {
    STATE.platform = "auto";
  }
  updatePlatformUI();
  showPlatformWatermark();
  showToast("已选择项目目录: " + handle.name, "success");
  await loadAllConfigs();
  buildConfigUI();
  loadArticles();
}

async function reconnectProject() {
  const handle = await loadDirHandle();
  if (handle) {
    await setProjectHandle(handle);
    return true;
  }
  return false;
}

async function refreshAllConfigs() {
  if (!STATE.projectDir) return;
  STATE.modifiedConfigs.clear();
  await loadAllConfigs();
  buildConfigUI();
  showToast("配置已刷新", "success");
}

async function readFile(relativePath) {
  if (!STATE.projectDir) throw new Error("未选择项目目录");
  const parts = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  let handle = STATE.projectDir;
  for (const part of parts) {
    handle = await handle.getDirectoryHandle(part, { create: false });
  }
  return handle;
}

async function readTextFile(relativePath) {
  const parts = relativePath.replace(/\\/g, "/").split("/");
  const fileName = parts.pop();
  const dirPath = parts.filter(Boolean);
  let handle = STATE.projectDir;
  for (const part of dirPath) {
    handle = await handle.getDirectoryHandle(part, { create: false });
  }
  const fileHandle = await handle.getFileHandle(fileName, {
    create: false,
  });
  const file = await fileHandle.getFile();
  return await file.text();
}

async function writeTextFile(relativePath, content) {
  // 1) Try File System Access API first (writes to correct handle dir)
  try {
    const parts = relativePath.replace(/\\/g, "/").split("/");
    const fileName = parts.pop();
    const dirPath = parts.filter(Boolean);
    let handle = STATE.projectDir;
    for (const part of dirPath) {
      handle = await handle.getDirectoryHandle(part, { create: true });
    }
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    console.log("[Write:FSA] " + relativePath + " OK");
    return;
  } catch (e) {
    console.warn("[Write:FSA] failed, trying server: " + e.message);
  }
  // 2) Fallback: server-side write
  try {
    const resp = await fetch("/api/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: relativePath,
        content: content,
        projectName: STATE.projectDir ? STATE.projectDir.name : "",
      }),
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const result = await resp.json();
    if (!result.ok) throw new Error(result.error);
    console.log("[Write:SVR] " + relativePath + " OK");
  } catch (e) {
    console.error("[Write] 保存失败: " + e.message);
    throw e;
  }
}

async function listDir(relativePath) {
  const parts = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  let handle = STATE.projectDir;
  for (const part of parts) {
    handle = await handle.getDirectoryHandle(part, { create: false });
  }
  const entries = [];
  for await (const [name, entry] of handle.entries()) {
    entries.push({ name, kind: entry.kind, handle: entry });
  }
  return entries;
}

// Server-side file listing (bypasses FSA API stale snapshot issue)
async function listDirServer(relativePath) {
  const cleanPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resp = await fetch("/api/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dirPath: cleanPath,
      projectName: STATE.projectDir ? STATE.projectDir.name : "",
    }),
  });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error);
  return data.entries;
}

// Merged list: uses FSA first, falls back to server to catch files
// created externally (e.g. server-side uploads that FSA handle may not see)
async function listDirMerged(relativePath) {
  let fsaEntries = [];
  let svrEntries = [];
  let fsaOk = false;
  try {
    fsaEntries = await listDir(relativePath) || [];
    fsaOk = true;
  } catch(e) {
    console.warn("[listDir] FSA failed, trying server: " + (e && e.message || e));
  }
  try {
    svrEntries = await listDirServer(relativePath) || [];
  } catch(e) {
    console.warn("[listDir] Server list failed: " + (e && e.message || e));
  }
  if (!fsaOk) return svrEntries;
  // Merge: server entries not already seen in FSA
  const fsaNames = {};
  fsaEntries.forEach(function(e) { fsaNames[e.name] = true; });
  const merged = fsaEntries.slice();
  svrEntries.forEach(function(e) {
    if (!fsaNames[e.name]) merged.push(e);
  });
  return merged;
}

async function deleteFile(relativePath) {
  // 1) Try File System Access API first
  try {
    const parts = relativePath.replace(/\\/g, "/").split("/");
    const fileName = parts.pop();
    const dirPath = parts.filter(Boolean);
    let handle = STATE.projectDir;
    for (const part of dirPath) {
      handle = await handle.getDirectoryHandle(part, { create: false });
    }
    await handle.removeEntry(fileName);
    console.log("[Delete:FSA] " + relativePath + " OK");
    return;
  } catch (e) {
    console.warn("[Delete:FSA] failed, trying server: " + e.message);
  }
  // 2) Fallback: server-side delete
  try {
    const resp = await fetch("/api/file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath: relativePath,
        projectName: STATE.projectDir ? STATE.projectDir.name : "",
      }),
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const result = await resp.json();
    if (!result.ok) throw new Error(result.error);
    console.log("[Delete:SVR] " + relativePath + " OK");
  } catch (e) {
    console.error("[Delete] 删除失败: " + e.message);
    throw e;
  }
}
