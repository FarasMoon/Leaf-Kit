// ============================================================
// Shared state & utilities for the blog editor server
// ============================================================

const fs = require("fs");
const path = require("path");

const BASE_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(BASE_DIR, "src");
const ROOT_DIR = path.resolve(BASE_DIR, "..");

const MAX_OUTPUT_LINES = 500;

// Preview process state
let previewProcess = null;
let previewOutput = [];
let previewUrl = "";

// Git push state
let gitPushProcess = null;
let gitPushOutput = [];
let gitPushSucceeded = null; // null=unknown, true=success, false=fail

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function addPreviewLine(text) {
  previewOutput.push(stripAnsi(text));
  if (previewOutput.length > MAX_OUTPUT_LINES) previewOutput.shift();
}

function stopPreviewProcess() {
  if (!previewProcess || !previewProcess.pid) {
    previewProcess = null;
    return;
  }
  const pid = previewProcess.pid;
  try {
    if (process.platform === "win32") {
      const { execSync } = require("child_process");
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
      } catch (_) {}
      try {
        execSync(
          `for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4321 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul`,
          { stdio: "ignore", shell: "cmd" }
        );
      } catch (_) {}
    } else {
      try { process.kill(-pid, "SIGTERM"); } catch (e) {}
    }
  } catch (e) {}
  previewProcess = null;
}

function addGitPushLine(text) {
  gitPushOutput.push(stripAnsi(text));
  if (gitPushOutput.length > MAX_OUTPUT_LINES) gitPushOutput.shift();
}

function stopGitPushProcess() {
  if (!gitPushProcess || !gitPushProcess.pid) {
    gitPushProcess = null;
    return;
  }
  const pid = gitPushProcess.pid;
  try {
    if (process.platform === "win32") {
      const { execSync } = require("child_process");
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
      } catch (_) {}
    } else {
      try { process.kill(-pid, "SIGTERM"); } catch (e) {}
    }
  } catch (e) {}
  gitPushProcess = null;
}

// Shared: resolve blog project directory from a project name hint
function resolveProjectDir(projectName) {
  if (projectName) {
    const subDir = path.normalize(path.join(ROOT_DIR, projectName));
    if (fs.existsSync(path.join(subDir, "package.json"))) return subDir;
  }
  try {
    const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "Blog-Editor" || entry.name === "node_modules") continue;
      const candidate = path.join(ROOT_DIR, entry.name);
      if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    }
  } catch (_) {}
  if (fs.existsSync(path.join(ROOT_DIR, "package.json"))) return ROOT_DIR;
  return ROOT_DIR;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("404 Not Found");
  }
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyDirSyncExclude(src, dest, excludeNames) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeNames.indexOf(entry.name) >= 0) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSyncExclude(srcPath, destPath, excludeNames);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function countFilesSync(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFilesSync(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

module.exports = {
  BASE_DIR,
  SRC_DIR,
  ROOT_DIR,
  MAX_OUTPUT_LINES,
  previewProcess: { get: () => previewProcess, set: (v) => { previewProcess = v; } },
  previewOutput: { get: () => previewOutput, set: (v) => { previewOutput = v; } },
  previewUrl: { get: () => previewUrl, set: (v) => { previewUrl = v; } },
  gitPushProcess: { get: () => gitPushProcess, set: (v) => { gitPushProcess = v; } },
  gitPushOutput: { get: () => gitPushOutput, set: (v) => { gitPushOutput = v; } },
  gitPushSucceeded: { get: () => gitPushSucceeded, set: (v) => { gitPushSucceeded = v; } },
  stripAnsi,
  addPreviewLine,
  stopPreviewProcess,
  addGitPushLine,
  stopGitPushProcess,
  resolveProjectDir,
  MIME,
  serveFile,
  copyDirSync,
  copyDirSyncExclude,
  countFilesSync,
};
