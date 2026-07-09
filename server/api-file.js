// ============================================================
// api-file.js — File write / upload / list / delete handlers
// ============================================================

const fs = require("fs");
const path = require("path");
const { parseMultipart } = require("./multipart.js");
const { resolveProjectDir } = require("./shared.js");

function handleWrite(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body);
      const projectName = data.projectName || "";
      const projectDir = resolveProjectDir(projectName);
      const relPath = data.path.replace(/\\/g, "/");
      const filePath = path.normalize(path.join(projectDir, relPath));
      if (!filePath.startsWith(path.normalize(projectDir))) {
        res.writeHead(403);
        res.end(JSON.stringify({ ok: false, error: "Forbidden" }));
        return;
      }
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, data.content, "utf-8");
      const written = fs.readFileSync(filePath, "utf-8");
      if (written !== data.content) throw new Error("Verify failed");
      console.log(
        "[WRITE] " + relPath + " (" + data.content.length + " bytes) OK",
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          path: relPath,
          bytes: data.content.length,
        }),
      );
    } catch (e) {
      console.error("[WRITE] ERROR:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

function handleUpload(req, res, contentType) {
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) {
    res.writeHead(400);
    res.end(JSON.stringify({ ok: false, error: "No boundary" }));
    return;
  }
  const boundary = boundaryMatch[1];
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const buffer = Buffer.concat(chunks);
      const result = parseMultipart(buffer, boundary);
      if (!result.file) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: "No file" }));
        return;
      }
      const uploadDir = (result.fields.dir || "public/images").trim();
      const projectName = (result.fields.projectName || "").trim();
      const projectDir = resolveProjectDir(projectName);
      const targetDir = path.normalize(path.join(projectDir, uploadDir));
      if (!targetDir.startsWith(path.normalize(projectDir))) {
        res.writeHead(403);
        res.end(JSON.stringify({ ok: false, error: "Forbidden" }));
        return;
      }
      if (!fs.existsSync(targetDir))
        fs.mkdirSync(targetDir, { recursive: true });

      // Determine naming strategy based on directory context
      const relDir = uploadDir.replace(/\\/g, "/");
      let namingPrefix = null;
      if (relDir.includes("wallpaper/desktop")) {
        namingPrefix = "d";
      } else if (relDir.includes("wallpaper/mobile")) {
        namingPrefix = "m";
      }

      const isGalleryAlbum = relDir.match(/^public\/gallery\/([^/]+)$/);

      // Normalize extension
      const rawExt = path.extname(result.filename).toLowerCase();
      const extMap = { ".jpeg": ".jpg", ".svg+xml": ".svg", ".apng": ".png" };
      let ext = extMap[rawExt] || rawExt;
      const validExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"];
      if (validExts.indexOf(ext) === -1) ext = ".png";

      let filename;
      if (namingPrefix) {
        // Wallpaper naming: d1.png, d2.avif, m1.jpg, etc.
        let existingFiles = [];
        try { existingFiles = fs.readdirSync(targetDir); } catch (_) {}
        let maxNum = 0;
        const prefixPattern = new RegExp("^" + namingPrefix + "(\\d+)\\.");
        for (const f of existingFiles) {
          const match = f.match(prefixPattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        filename = namingPrefix + (maxNum + 1) + ext;
      } else if (isGalleryAlbum) {
        // Gallery album: sequential numbers (1.jpg, 2.png, etc.)
        let existingFiles = [];
        try { existingFiles = fs.readdirSync(targetDir); } catch (_) {}
        let maxNum = 0;
        const numPattern = /^(\d+)\.[a-z]+$/;
        for (const f of existingFiles) {
          const match = f.match(numPattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        filename = (maxNum + 1) + ext;
      } else {
        // Generic: img_{ts}_{random}.{ext}
        const shortId = Math.random().toString(36).slice(2, 8);
        filename = "img_" + Date.now() + "_" + shortId + ext;
      }

      let filePath = path.join(targetDir, filename);
      // Avoid collision
      let collisionSuffix = 0;
      while (fs.existsSync(filePath)) {
        collisionSuffix++;
        const baseName = filename.replace(ext, "");
        filename = baseName + "_" + collisionSuffix + ext;
        filePath = path.join(targetDir, filename);
      }

      fs.writeFileSync(filePath, result.file);
      const relPath = "/" + path.relative(projectDir, filePath).replace(/\\/g, "/");
      console.log(
        "[UPLOAD] " + relPath + " (" + result.file.length + " bytes)",
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: relPath }));
    } catch (e) {
      console.error("[UPLOAD] ERROR:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

function handleList(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body || "{}");
      const projectName = (data.projectName || "").trim();
      const dirPath = (data.dirPath || "").trim();
      if (!dirPath) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: "No dirPath" }));
        return;
      }
      const projectDir = resolveProjectDir(projectName);
      const targetPath = path.normalize(path.join(projectDir, dirPath.replace(/^\//, "")));
      if (!targetPath.startsWith(path.normalize(projectDir))) {
        res.writeHead(403);
        res.end(JSON.stringify({ ok: false, error: "Forbidden" }));
        return;
      }
      if (!fs.existsSync(targetPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, entries: [] }));
        return;
      }
      const dirEntries = fs.readdirSync(targetPath, { withFileTypes: true });
      const entries = dirEntries.map(function (de) {
        return {
          name: de.name,
          kind: de.isDirectory() ? "directory" : "file",
        };
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, entries }));
    } catch (e) {
      console.error("[LIST] ERROR:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

function handleDelete(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body || "{}");
      const projectName = (data.projectName || "").trim();
      const filePath = (data.filePath || "").trim();
      if (!filePath) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: "No filePath" }));
        return;
      }
      const projectDir = resolveProjectDir(projectName);
      const targetPath = path.normalize(path.join(projectDir, filePath.replace(/^\//, "")));
      if (!targetPath.startsWith(path.normalize(projectDir))) {
        res.writeHead(403);
        res.end(JSON.stringify({ ok: false, error: "Forbidden" }));
        return;
      }
      if (!fs.existsSync(targetPath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: "File not found" }));
        return;
      }
      fs.unlinkSync(targetPath);
      console.log("[DELETE] " + filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      console.error("[DELETE] ERROR:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

module.exports = { handleWrite, handleUpload, handleList, handleDelete };
