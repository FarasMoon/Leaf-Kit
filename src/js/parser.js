// ============================================================
// Config Parser — TS config file parsing & data access
// ============================================================

// ── Shared parsing utilities ──

/**
 * Skip a string literal. `i` points to the opening quote.
 * Returns index pointing to the closing quote.
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
 * Skip a comment (line or block). `i` points to the opening `/`.
 * Returns index of last character in the comment (newline for //, slash-star for star-slash).
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
 * Check if current position starts a string or comment, and if so skip it.
 * Returns new index. If no string/comment at position, returns original i.
 * Designed for use inside for-loops: `i = skipStringOrComment(content, i);`
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
 * Load all config files according to the current schema.
 * Reads each .ts file, parses it, and stores the result in STATE.configs.
 */
async function loadAllConfigs() {
  if (!STATE.projectDir) return;
  // Lazy-load the platform schema before parsing
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
 * Parse a TypeScript config file content into a JS object.
 * Handles `export const X = { ... }` patterns.
 */
function parseConfigTS(tsContent, configKey) {
  if (configKey === "friendsConfig") {
    return parseFriendsConfig(tsContent);
  }

  let startMatch;
  if (typeof getPlatformLayout === "function" && getPlatformLayout() === "single") {
    // Single-file platforms: each export name matches the configKey exactly
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
 * Parse the split-format friendsConfig.ts into the blog-editor's combined format.
 */
function parseFriendsConfig(content) {
  const result = {};

  // Extract friendsPageConfig object
  const pageMatch = content.match(/export\s+const\s+friendsPageConfig\s*(?::\s*\w+)?\s*=\s*\{/);
  if (pageMatch) {
    const start = pageMatch.index + pageMatch[0].length - 1;
    const end = findMatchingBrace(content, start);
    if (end !== -1) {
      const pageObj = extractSimpleObj(content, start, end);
      for (const k in pageObj) result[k] = pageObj[k];
    }
  }

  // Extract friends array
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

  // Fallback: old format
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
 * Find matching closing brace starting from openBracePos (which points to the {).
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
 * Find matching closing bracket starting from openBracketPos (which points to the [).
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
 * Parse array items from array content (between [ and ]).
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
        } catch (e) { /* skip malformed items */ }
        itemStart = -1;
      }
    } else {
      i = skipStringOrComment(arrContent, i);
    }
  }
  return items;
}

/**
 * Fallback: extract a simple object from TS content by text replacement.
 */
function extractSimpleObj(content, start, end) {
  let inner = content.substring(start + 1, end);
  inner = inner.replace(/\bSITE_LANG\b/g, '"zh_CN"');
  inner = inner.replace(/\bLinkPresets?\.(\w+)\b/g, '"$1"');
  inner = inner.replace(/\bNavBarSearchMethod\.(\w+)\b/g, '"$1"');
  return parseObjInner(inner);
}

/**
 * Recursive parser for JS object literal content (between { and }).
 */
function parseObjInner(inner) {
  const result = {};
  let i = 0, len = inner.length;

  while (i < len) {
    // Skip whitespace and commas
    while (i < len && (inner[i] === " " || inner[i] === "\n" || inner[i] === "\r" || inner[i] === "\t" || inner[i] === ",")) i++;
    if (i >= len) break;

    // Skip comments
    if (inner[i] === "/" && (inner[i + 1] === "/" || inner[i + 1] === "*")) {
      i = skipComment(inner, i);
      if (inner[i] !== "\n") i++; // skip past */, for // already at \n
      continue;
    }

    // Read key (identifier)
    const keyStart = i;
    while (i < len && /[a-zA-Z0-9_$]/.test(inner[i])) i++;
    const key = inner.substring(keyStart, i);
    if (!key) break;

    // Skip whitespace, colon, whitespace
    while (i < len && (inner[i] === " " || inner[i] === "\t")) i++;
    if (i >= len || inner[i] !== ":") break;
    i++;
    while (i < len && (inner[i] === " " || inner[i] === "\t" || inner[i] === "\n" || inner[i] === "\r")) i++;

    // Read value
    const value = readValue(inner, i);
    if (value === undefined) break;
    i = value.nextI;
    setNestedValue(result, key, value.val);

    // Skip trailing whitespace and optional comma
    while (i < len && (inner[i] === " " || inner[i] === "\t" || inner[i] === "\n" || inner[i] === "\r")) i++;
    if (inner[i] === ",") i++;
  }
  return result;
}

/**
 * Read a single JSON-like value from a string starting at index i.
 * Returns { val, nextI } or undefined on failure.
 * Uses skipString/skipComment helpers for string and comment skipping.
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
        if (inner[i] !== "\n") i++; // skip past */ for block comments
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
 * Get config values for the given fields from STATE.configs[key].
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
 * Read a nested value from an object using dot-path notation.
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
 * Set a nested value in an object using dot-path notation.
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

// ── Attach to window for backward compatibility with non-module scripts ──
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
