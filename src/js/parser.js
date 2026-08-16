// ============================================================
// 配置解析器 — TS 配置文件解析和数据访问
// ============================================================

// ── 共享解析工具函数 ──

/**
 * 跳过一个字符串字面量。`i` 指向开头的引号。
 * 返回指向闭合引号的索引。
 */
function skipString(content, i) {
  const q = content[i];
  i++;
  while (i < content.length && content[i] !== q) {
    if (content[i] === "\\") i++;
    i++;
  }
  return i;
}

/**
 * 跳过一个注释（行注释或块注释）。`i` 指向开头的 `/`。
 * 返回注释中最后一个字符的索引（行注释结尾为换行符，块注释结尾为星号加斜杠）。
 */
function skipComment(content, i) {
  if (content[i + 1] === "/") {
    while (i < content.length && content[i] !== "\n") i++;
  } else if (content[i + 1] === "*") {
    i += 2;
    while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
    i++;
  }
  return i;
}

/**
 * 检查当前位置是否开始一个字符串或注释，如果是则跳过。
 * 返回新的索引。如果该位置没有字符串/注释，则返回原始的 i。
 * 设计用于 for 循环内部：`i = skipStringOrComment(content, i);`
 */
function skipStringOrComment(content, i) {
  const ch = content[i];
  if (ch === '"' || ch === "'" || ch === "`") {
    return skipString(content, i);
  }
  if (ch === "/" && (content[i + 1] === "/" || content[i + 1] === "*")) {
    return skipComment(content, i);
  }
  return i;
}

// ============================================================

/**
 * 根据当前 schema 加载所有配置文件。
 * 读取每个 .ts 文件，解析，并将结果存储在 STATE.configs 中。
 */
async function loadAllConfigs() {
  if (!STATE.projectDir) return;
  // 解析前先懒加载平台 schema
  await loadPlatformSchema(getCurrentPlatform());
  let loaded = 0, failed = 0;
  const fileCache = {};

  for (const [key, schema] of Object.entries(getCurrentSchema())) {
    try {
      let raw;
      if (fileCache[schema.file]) {
        raw = fileCache[schema.file];
      } else {
        raw = await readTextFile(schema.file);
        fileCache[schema.file] = raw;
      }
      const parsed = parseConfigTS(raw, key);
      STATE.configs[key] = parsed;
      loaded++;
      console.log("[Config] " + key + " loaded: " + schema.file);
    } catch (e) {
      console.warn("[Config] " + key + " FAILED: " + schema.file + " - " + e.message, e);
      STATE.configs[key] = {};
      failed++;
    }
  }
  if (failed > 0) {
    showToast("已加载 " + loaded + "/" + (loaded + failed) + " 个配置文件（" + failed + " 个失败）",
      failed > loaded ? "error" : "warning");
  }
}

/**
 * 将 TypeScript 配置文件内容解析为 JS 对象。
 * 处理 `export const X = { ... }` 模式。
 */
function parseConfigTS(tsContent, configKey) {
  if (configKey === "friendsConfig") {
    return parseFriendsConfig(tsContent);
  }

  let startMatch;
  if (typeof getPlatformLayout === "function" && getPlatformLayout() === "single") {
    // Single-file 平台：每个导出名称直接匹配 configKey
    const keyRegex = new RegExp("export\\s+const\\s+" + configKey + "\\s*(?::\\s*\\w+)?\\s*=\\s*\\{");
    startMatch = tsContent.match(keyRegex);
  } else {
    startMatch = tsContent.match(/export\s+const\s+(\w+)\s*(?::\s*\w+)?\s*=\s*\{/);
  }
  if (!startMatch) {
    console.warn("[Config] " + configKey + ": export const not found in TS content");
    return {};
  }

  const start = startMatch.index + startMatch[0].length - 1;
  let depth = 0, end = -1;

  for (let i = start; i < tsContent.length; i++) {
    const ch = tsContent[i];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    } else if (ch === '"' || ch === "'" || ch === "`" || (ch === "/" && (tsContent[i + 1] === "/" || tsContent[i + 1] === "*"))) {
      i = skipStringOrComment(tsContent, i);
    }
  }
  if (end === -1) {
    console.warn("[Config] " + configKey + ": unmatched braces in TS content");
    return {};
  }

  try {
    return extractSimpleObj(tsContent, start, end);
  } catch (e) {
    console.warn("[Config] " + configKey + ": extraction failed - " + e.message, e);
    return {};
  }
}

/**
 * 将拆分格式的 friendsConfig.ts 解析为博客编辑器的组合格式。
 */
function parseFriendsConfig(content) {
  const result = {};

  // 提取 friendsPageConfig 对象
  const pageMatch = content.match(/export\s+const\s+friendsPageConfig\s*(?::\s*\w+)?\s*=\s*\{/);
  if (pageMatch) {
    const start = pageMatch.index + pageMatch[0].length - 1;
    const end = findMatchingBrace(content, start);
    if (end !== -1) {
      const pageObj = extractSimpleObj(content, start, end);
      for (const k in pageObj) result[k] = pageObj[k];
    }
  }

  // 提取 friends 数组
  const arrMatch = content.match(/export\s+const\s+friends\s*(?::\s*\w+(?:\[\])?)?\s*=\s*\[/);
  if (arrMatch) {
    const arrStart = arrMatch.index + arrMatch[0].length - 1;
    const arrEnd = findMatchingBracket(content, arrStart);
    if (arrEnd !== -1) {
      const arrStr = content.substring(arrStart + 1, arrEnd);
      let items = parseArrayItems(arrStr);
      items = items.map(function (item) {
        if (Array.isArray(item.tags)) {
          item.tags = item.tags.join(", ");
        }
        return item;
      });
      result.friends = items;
    }
  }

  // 回退：旧格式
  if (!pageMatch) {
    const oldMatch = content.match(/export\s+const\s+friendsConfig\s*(?::\s*\w+)?\s*=\s*\{/);
    if (oldMatch) {
      const oldStart = oldMatch.index + oldMatch[0].length - 1;
      const oldEnd = findMatchingBrace(content, oldStart);
      if (oldEnd !== -1) {
        const oldObj = extractSimpleObj(content, oldStart, oldEnd);
        for (const k2 in oldObj) result[k2] = oldObj[k2];
      }
    }
  }

  return result;
}

/**
 * 找到匹配的闭合花括号，从 openBracePos（指向 {）开始。
 */
function findMatchingBrace(content, openBracePos) {
  let depth = 0;
  for (let i = openBracePos; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    } else {
      i = skipStringOrComment(content, i);
    }
  }
  return -1;
}

/**
 * 找到匹配的闭合方括号，从 openBracketPos（指向 [）开始。
 */
function findMatchingBracket(content, openBracketPos) {
  let depth = 0;
  for (let i = openBracketPos; i < content.length; i++) {
    const ch = content[i];
    if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    } else {
      i = skipStringOrComment(content, i);
    }
  }
  return -1;
}

/**
 * 从数组内容中解析数组项（位于 [ 和 ] 之间）。
 */
function parseArrayItems(arrContent) {
  const items = [];
  let depth = 0, itemStart = -1;

  for (let i = 0; i < arrContent.length; i++) {
    const ch = arrContent[i];
    if (ch === "{" && depth === 0) {
      itemStart = i;
      depth++;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && itemStart >= 0) {
        const itemStr = arrContent.substring(itemStart, i + 1);
        try {
          const parsed = parseObjInner(itemStr);
          items.push(parsed);
        } catch (e) { /* 跳过格式错误的项 */ }
        itemStart = -1;
      }
    } else {
      i = skipStringOrComment(arrContent, i);
    }
  }
  return items;
}

/**
 * 回退：通过文本替换从 TS 内容中提取简单对象。
 */
function extractSimpleObj(content, start, end) {
  let inner = content.substring(start + 1, end);
  inner = inner.replace(/\bSITE_LANG\b/g, '"zh_CN"');
  inner = inner.replace(/\bLinkPresets?\.(\w+)\b/g, '"$1"');
  inner = inner.replace(/\bNavBarSearchMethod\.(\w+)\b/g, '"$1"');
  return parseObjInner(inner);
}

/**
 * JS 对象字面量内容的递归解析器（位于 { 和 } 之间）。
 */
function parseObjInner(inner) {
  const result = {};
  let i = 0, len = inner.length;

  while (i < len) {
    // 跳过空白和逗号
    while (i < len && (inner[i] === " " || inner[i] === "\n" || inner[i] === "\r" || inner[i] === "\t" || inner[i] === ",")) i++;
    if (i >= len) break;

    // 跳过注释
    if (inner[i] === "/" && (inner[i + 1] === "/" || inner[i + 1] === "*")) {
      i = skipComment(inner, i);
      if (inner[i] !== "\n") i++; // 跳过 */，对于 // 已经在 \n 处
      continue;
    }

    // 读取键（标识符）
    const keyStart = i;
    while (i < len && /[a-zA-Z0-9_$]/.test(inner[i])) i++;
    const key = inner.substring(keyStart, i);
    if (!key) break;

    // 跳过空白、冒号、空白
    while (i < len && (inner[i] === " " || inner[i] === "\t")) i++;
    if (i >= len || inner[i] !== ":") break;
    i++;
    while (i < len && (inner[i] === " " || inner[i] === "\t" || inner[i] === "\n" || inner[i] === "\r")) i++;

    // 读取值
    const value = readValue(inner, i);
    if (value === undefined) break;
    i = value.nextI;
    setNestedValue(result, key, value.val);

    // 跳过尾部空白和可选逗号
    while (i < len && (inner[i] === " " || inner[i] === "\t" || inner[i] === "\n" || inner[i] === "\r")) i++;
    if (inner[i] === ",") i++;
  }
  return result;
}

/**
 * 从字符串中读取一个类似 JSON 的值，从索引 i 开始。
 * 返回 { val, nextI }，失败则返回 undefined。
 * 使用 skipString/skipComment 辅助函数来处理字符串和注释。
 */
function readValue(inner, i) {
  const ch = inner[i];
  let val;

  if (ch === '"' || ch === "'" || ch === "`") {
    const q = ch;
    i++;
    const vs = i;
    while (i < inner.length && inner[i] !== q) {
      if (inner[i] === "\\") i++;
      i++;
    }
    val = inner.substring(vs, i);
    i++;
  } else if (ch === "{") {
    let depth = 0, start = i;
    while (i < inner.length) {
      const c = inner[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { i++; break; }
      } else if (c === '"' || c === "'" || c === "`") {
        i = skipString(inner, i);
      } else if (c === "/" && (inner[i + 1] === "/" || inner[i + 1] === "*")) {
        i = skipComment(inner, i);
      }
      i++;
    }
    val = parseObjInner(inner.substring(start + 1, i - 1));
  } else if (ch === "[") {
    i++;
    const arr = [];
    while (i < inner.length && inner[i] !== "]") {
      while (i < inner.length && (inner[i] === " " || inner[i] === "\t" || inner[i] === "\n" || inner[i] === "\r" || inner[i] === ",")) i++;
      if (inner[i] === "]") break;
      if (inner[i] === "/" && (inner[i + 1] === "/" || inner[i + 1] === "*")) {
        i = skipComment(inner, i);
        if (inner[i] !== "\n") i++; // 对于块注释跳过 */
        continue;
      }
      const item = readValue(inner, i);
      if (item === undefined) break;
      arr.push(item.val);
      i = item.nextI;
      while (i < inner.length && (inner[i] === " " || inner[i] === "\t" || inner[i] === "\n" || inner[i] === "\r")) i++;
      if (inner[i] === ",") i++;
    }
    i++;
    val = arr;
  } else if (ch === "t" || ch === "f") {
    const w = inner.substring(i, i + 5);
    if (w.startsWith("true")) { val = true; i += 4; }
    else if (w.startsWith("false")) { val = false; i += 5; }
    else return undefined;
  } else if (ch === "-" || (ch >= "0" && ch <= "9")) {
    const ns = i;
    while (i < inner.length && /[\d.\-]/.test(inner[i])) i++;
    const numStr = inner.substring(ns, i);
    if (/^-?\d+(\.\d+)?$/.test(numStr)) val = Number(numStr);
    else return undefined;
  } else {
    const us = i;
    while (i < inner.length && inner[i] !== "," && inner[i] !== "}") {
      if (inner[i] === '"' || inner[i] === "'" || inner[i] === "`") {
        i = skipString(inner, i);
      } else if (inner[i] === "/" && (inner[i + 1] === "/" || inner[i + 1] === "*")) {
        i = skipComment(inner, i);
      }
      i++;
    }
    val = inner.substring(us, i).trim();
    if (!val) val = "";
  }
  return { val, nextI: i };
}

/**
 * 从 STATE.configs[key] 中获取指定字段的配置值。
 */
function getConfigValue(key, fields) {
  const data = STATE.configs[key];
  if (!data || typeof data !== "object") return null;
  const vals = {};
  for (const f of fields) {
    vals[f.key] = getNestedValue(data, f.key);
  }
  return vals;
}

/**
 * 使用点路径表示法从对象中读取嵌套值。
 */
function getNestedValue(obj, path) {
  const parts = path.split(".");
  let current = obj;
  for (const p of parts) {
    if (current == null) return "";
    current = current[p];
  }
  return current != null ? current : "";
}

/**
 * 使用点路径表示法在对象中设置嵌套值。
 */
function setNestedValue(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// ── 挂载到 window 以保证与非模块脚本的向后兼容 ──
Object.assign(window, {
  loadAllConfigs,
  parseConfigTS,
  extractSimpleObj,
  parseObjInner,
  readValue,
  getConfigValue,
  getNestedValue,
  setNestedValue,
});
