// ============================================================
// api-git.js — Git push / SSH check handlers
// ============================================================

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
  gitPushProcess,
  gitPushOutput,
  gitPushSucceeded,
  addGitPushLine,
  stopGitPushProcess,
  resolveProjectDir,
  copyDirSyncExclude,
  countFilesSync,
} = require("./shared.js");

function handleGitPushStart(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body || "{}");
      const projectName = data.projectName || "";
      const remoteUrl = data.remoteUrl || "";
      const branch = data.branch || "gh-pages";
      const force = data.force !== false;

      if (!remoteUrl) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: "缺少远程仓库地址 (remoteUrl)" }));
        return;
      }

      const absProjectDir = resolveProjectDir(projectName);
      const projectDir = absProjectDir;
      if (!fs.existsSync(projectDir)) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: "项目目录不存在" }));
        return;
      }

      stopGitPushProcess();
      gitPushOutput.set([]);
      gitPushSucceeded.set(null);

      const tmpDir = path.join(absProjectDir, ".deploy-tmp");
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

      addGitPushLine("[系统] 准备推送项目到 " + remoteUrl + " (分支: " + branch + ")");
      addGitPushLine("[系统] 源目录: " + projectDir);

      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        copyDirSyncExclude(projectDir, tmpDir, [".git", "node_modules", ".deploy-tmp", ".deploy-push.bat"]);
        addGitPushLine("[系统] 已复制 " + countFilesSync(tmpDir) + " 个文件到临时目录");
      } catch (e) {
        addGitPushLine("[错误] 复制文件失败: " + e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: e.message }));
        return;
      }

      const commitMsg = "Deploy: " + new Date().toISOString().replace(/\..+/, "");

      const scriptLines = [
        `cd /d "${tmpDir}"`,
        `git init`,
        `git config core.autocrlf false`,
        `git checkout -b main`,
        `git add .`,
        `git -c user.name=Blog-Editor -c user.email=blog-editor@local commit -m "${commitMsg}"`,
        `git remote remove origin 2>nul`,
        `git remote add origin ${remoteUrl}`,
        `git push ${force ? "-f" : ""} origin main:${branch}`,
      ];

      const batPath = path.join(absProjectDir, ".deploy-push.bat");
      fs.writeFileSync(batPath, "@echo off\r\n" + scriptLines.join("\r\n") + "\r\n");

      addGitPushLine("[系统] 推送: " + remoteUrl + " → " + branch);

      const proc = spawn("cmd", ["/c", batPath], {
        cwd: absProjectDir,
        env: { ...process.env, GIT_SSH_COMMAND: "ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      function cleanupGitPush() {
        try { fs.unlinkSync(batPath); } catch (_) {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
      }

      proc.stdout.on("data", (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        lines.forEach((line) => addGitPushLine(line));
      });

      proc.stderr.on("data", (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        lines.forEach((line) => addGitPushLine("[GIT] " + line));
      });

      proc.on("close", (code) => {
        gitPushSucceeded.set(code === 0);
        addGitPushLine("[系统] Git 推送完成，退出代码: " + (code ?? "null"));
        if (code === 0) {
          addGitPushLine("[系统] ✓ 推送成功！");
        } else {
          addGitPushLine("[系统] ✗ 推送失败，请检查 SSH 密钥和远程仓库地址");
        }
        cleanupGitPush();
        if (gitPushProcess.get()) gitPushProcess.set(null);
      });

      proc.on("error", (err) => {
        addGitPushLine("[错误] 启动 git 失败: " + err.message);
        gitPushProcess.set(null);
        cleanupGitPush();
      });

      gitPushProcess.set(proc);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "Push starting..." }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

function handleGitPushStatus(req, res) {
  const proc = gitPushProcess.get();
  const running = proc !== null && proc.exitCode === null;
  const output = gitPushOutput.get().slice(-200).join("\n");
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ running, output, succeeded: gitPushSucceeded.get() }));
}

function handleGitPushCancel(req, res) {
  stopGitPushProcess();
  addGitPushLine("[系统] 推送已取消");
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

function handleGitCheckSSH(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body || "{}");
      const host = data.host || "github.com";
      const isWin = process.platform === "win32";
      const proc = spawn(isWin ? "cmd" : "sh", [
        isWin ? "/c" : "-c",
        `ssh -T -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10 git@${host} 2>&1`,
      ]);
      let result = "";
      proc.stdout.on("data", (d) => (result += d.toString()));
      proc.stderr.on("data", (d) => (result += d.toString()));
      proc.on("close", (code) => {
        const ok = result.indexOf("successfully authenticated") >= 0 ||
                   result.indexOf("Hi ") >= 0 ||
                   result.indexOf("You've successfully authenticated") >= 0;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok, message: result.trim() }));
      });
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

module.exports = { handleGitPushStart, handleGitPushStatus, handleGitPushCancel, handleGitCheckSSH };
