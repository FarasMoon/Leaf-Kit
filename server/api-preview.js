// ============================================================
// api-preview.js — Preview start / stop / status handlers
// ============================================================

const { spawn } = require("child_process");
const {
  previewProcess,
  previewOutput,
  previewUrl,
  addPreviewLine,
  stopPreviewProcess,
  resolveProjectDir,
} = require("./shared.js");

function handlePreviewStart(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body || "{}");
      const projectName = data.projectName || "";

      const absProjectDir = resolveProjectDir(projectName);
      stopPreviewProcess();
      previewOutput.set([]);
      previewUrl.set("");

      addPreviewLine("[系统] 启动 pnpm dev 于 " + absProjectDir);
      addPreviewLine("[系统] 等待 Astro 开发服务器启动...");

      const proc = spawn("pnpm dev", [], {
        cwd: absProjectDir,
        env: { ...process.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      proc.stdout.on("data", (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        lines.forEach((line) => {
          addPreviewLine(line);
          const urlMatch = line.match(/https?:\/\/localhost:\d+/);
          if (urlMatch && !previewUrl.get()) {
            previewUrl.set(urlMatch[0]);
            addPreviewLine("[系统] 检测到预览地址: " + previewUrl.get());
          }
        });
      });

      proc.stderr.on("data", (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        lines.forEach((line) => addPreviewLine("[ERR] " + line));
      });

      proc.on("close", (code) => {
        addPreviewLine("[系统] 进程退出，代码: " + (code ?? "null"));
        if (previewProcess.get()) previewProcess.set(null);
        previewUrl.set("");
      });

      proc.on("error", (err) => {
        addPreviewLine("[错误] 启动失败: " + err.message);
        previewProcess.set(null);
      });

      previewProcess.set(proc);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "Preview starting..." }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

function handlePreviewStop(req, res) {
  stopPreviewProcess();
  addPreviewLine("[系统] 预览服务器已停止");
  previewUrl.set("");
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

function handlePreviewStatus(req, res) {
  const proc = previewProcess.get();
  const running = proc !== null && proc.exitCode === null;
  const output = previewOutput.get().slice(-200).join("\n");
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ running, url: previewUrl.get(), output }));
}

module.exports = { handlePreviewStart, handlePreviewStop, handlePreviewStatus };
