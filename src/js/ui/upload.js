// ============================================================
// 共享图片上传辅助函数
// ============================================================

export function uploadImage(file, dir) {
  return new Promise(function (resolve, reject) {
    const form = new FormData();
    form.append("file", file);
    form.append("dir", dir);
    form.append("projectName", STATE.projectDir ? STATE.projectDir.name : "");
    fetch("/api/upload", { method: "POST", body: form })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.path) resolve(data.path);
        else reject(new Error(data.error || "上传失败"));
      })
      .catch(reject);
  });
}

export function uploadMultipleImages(files, dir) {
  if (!files || files.length === 0) return Promise.resolve([]);
  // 顺序上传以避免竞态条件和浏览器连接限制
  const results = [];
  let idx = 0;
  function uploadNext() {
    if (idx >= files.length) return Promise.resolve(results);
    const file = files[idx];
    idx++;
    return uploadImage(file, dir).then(function (path) {
      if (path) results.push(path);
      return uploadNext();
    }).catch(function (err) {
      console.warn("[Upload] 第 " + idx + " 张上传失败:", err && err.message || err);
      return uploadNext();
    });
  }
  return uploadNext().then(function () {
    if (results.length === 0) {
      showToast("所有图片上传失败，请检查服务器是否运行", "error");
    } else if (results.length < files.length) {
      const failed = files.length - results.length;
      showToast("已上传 " + results.length + " 张，" + failed + " 张失败", "warning");
    }
    return results;
  });
}
