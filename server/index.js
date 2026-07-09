// ============================================================
// server/index.js — Blog Editor HTTP Server
// Entry point for the blog editor backend.
// ============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  BASE_DIR,
  SRC_DIR,
  ROOT_DIR,
  MIME,
  serveFile,
} = require("./shared.js");
const {
  handleWrite,
  handleUpload,
  handleList,
  handleDelete,
} = require("./api-file.js");
const {
  handlePreviewStart,
  handlePreviewStop,
  handlePreviewStatus,
} = require("./api-preview.js");
const {
  handleGitPushStart,
  handleGitPushStatus,
  handleGitPushCancel,
  handleGitCheckSSH,
} = require("./api-git.js");

const PORT = 6299;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // ── File API ──
  if (req.method === "POST" && req.url === "/api/write") {
    handleWrite(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/api/upload") {
    handleUpload(req, res, req.headers["content-type"] || "");
    return;
  }
  if (req.method === "POST" && req.url === "/api/list") {
    handleList(req, res);
    return;
  }
  if (req.method === "DELETE" && req.url === "/api/file") {
    handleDelete(req, res);
    return;
  }

  // ── Preview API ──
  if ((req.method === "POST" || req.method === "GET") && req.url === "/api/preview/start") {
    handlePreviewStart(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/api/preview/stop") {
    handlePreviewStop(req, res);
    return;
  }
  if (req.method === "GET" && req.url === "/api/preview/status") {
    handlePreviewStatus(req, res);
    return;
  }

  // ── Git API ──
  if (req.method === "POST" && req.url === "/api/git/push/start") {
    handleGitPushStart(req, res);
    return;
  }
  if (req.method === "GET" && req.url === "/api/git/push/status") {
    handleGitPushStatus(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/api/git/push/cancel") {
    handleGitPushCancel(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/api/git/check-ssh") {
    handleGitCheckSSH(req, res);
    return;
  }

  // ── Static file serving ──
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");

  const srcPath = path.join(SRC_DIR, safePath);
  if (fs.existsSync(srcPath)) {
    serveFile(res, srcPath);
  } else {
    serveFile(res, path.join(ROOT_DIR, safePath));
  }
});

server.listen(PORT, () => {
  console.log("============================================");
  console.log("  LeafKit Server - Port " + PORT);
  console.log("  http://localhost:" + PORT);
  console.log("============================================");
});
