// ============================================================
// Config Builder — TS code generation from JS objects
// ============================================================
// Platform metadata (layout, type paths, LinkPreset prefix) is
// defined in platform.js and accessed via state.js helpers.
// Adding a new "single-file" platform (like Fuwari) only requires:
//   1. Create schemas/<platform>.js with _meta section
//   2. Register in platform.js with layout: "single" + typeImports
//   3. Register in state.js getCurrentPlatform() detection

// ── Platform helpers (shortcuts) ──
function _platform() { return (getPlatformLayout() === "single") ? "single" : "multi"; }
function _isSingle() { return _platform() === "single"; }
function _typePath(key) { return getTypeImportPath(key); }
function _typeName(key) { return configKeyToTypeName(key); }
function _preset() { return getLinkPresetPrefix(); }

// ── Strategy Map: configKey → handler ──
// Only multi-file platforms use per-config handlers.
// Single-file platforms use buildSingleFileConfigs().

const BUILDERS = {
  siteConfig: function buildSite(configKey, data, lines) {
    lines.push('import type { ' + _typeName(configKey) + ' } from "' + _typePath(configKey) + '";');
    lines.push("");
    lines.push("// 定义站点语言");
    lines.push("const SITE_LANG = \"zh_CN\";");
    lines.push("");
    lines.push("export const " + configKey + ": " + _typeName(configKey) + " = " + objToTS(data, 0) + ";");
    if (!_isSingle()) {
      lines.push("");
      lines.push("export { SITE_LANG };");
    }
  },

  pioConfig: function buildPio(configKey, data, lines) {
    const schema = getCurrentSchema()[configKey];
    if (schema && schema.splitExports) {
      lines.push('import type { Live2DWidgetConfig, SpineModelConfig } from "../types/pioConfig";');
      lines.push("");
      lines.push("// Spine 看板娘配置");
      lines.push("export const spineModelConfig: SpineModelConfig = " + objToTS(data, 0) + ";");
      lines.push("");
      lines.push("// Live2D 看板娘配置 (使用 l2d-widget 库，文档：https://l2d-widget.hacxy.cn)");
      lines.push("export const live2dWidgetConfig: Live2DWidgetConfig = " + objToTS(data, 0) + ";");
    } else {
      lines.push('import type { PioConfig } from "' + _typePath(configKey) + '";');
      lines.push("");
      lines.push("// Pio 看板娘配置");
      lines.push("export const " + configKey + ": PioConfig = " + objToTS(data, 0));
    }
  },

  commentConfig: function buildComment(configKey, data, lines) {
    lines.push('import type { ' + _typeName(configKey) + ' } from "' + _typePath(configKey) + '";');
    if (!_isSingle()) {
      lines.push('import { SITE_LANG } from "./siteConfig";');
    }
    lines.push("");
    lines.push("export const " + configKey + ": " + _typeName(configKey) + " = " + objToTS(data, 0));
  },

  navBarConfig: function buildNavBar(configKey, data, lines) {
    const isFirefly = getCurrentPlatform() === "firefly";
    if (isFirefly) {
      lines.push('import { type NavBarConfig, type NavBarLink, type NavBarSearchConfig, NavBarSearchMethod } from "../types/navBarConfig";');
      lines.push("");
      lines.push("export const navBarSearchConfig: NavBarSearchConfig = {");
      lines.push('  method: NavBarSearchMethod.PageFind,');
      lines.push("};");
      lines.push("");
      lines.push("export const LinkPresets: Record<string, NavBarLink> = {");
      lines.push('  Home: { name: "主页", url: "/", icon: "material-symbols:home" },');
      lines.push('  Archive: { name: "归档", url: "/archive/", icon: "material-symbols:archive" },');
      lines.push('  Categories: { name: "分类", url: "/categories/", icon: "material-symbols:folder-open-rounded" },');
      lines.push('  Tags: { name: "标签", url: "/tags/", icon: "material-symbols:tag-rounded" },');
      lines.push('  Friends: { name: "友链", url: "/friends/", icon: "material-symbols:group", pageKey: "friends" },');
      lines.push('  Sponsor: { name: "打赏", url: "/sponsor/", icon: "material-symbols:favorite", pageKey: "sponsor" },');
      lines.push('  Guestbook: { name: "留言", url: "/guestbook/", icon: "material-symbols:chat", pageKey: "guestbook" },');
      lines.push('  About: { name: "关于我", url: "/about/", icon: "material-symbols:person" },');
      lines.push('  Bangumi: { name: "番组计划", url: "/bangumi/", icon: "material-symbols:movie", pageKey: "bangumi" },');
      lines.push('  Gallery: { name: "相册", url: "/gallery/", icon: "material-symbols:photo-library", pageKey: "gallery" },');
      lines.push('  Anime: { name: "追番", url: "/anime/", icon: "material-symbols:live-tv", pageKey: "anime" },');
      lines.push("};");
      lines.push("");
      const links = data && Array.isArray(data.links) ? data.links : [];
      if (links.length > 0) {
        lines.push("const getDynamicNavBarConfig = (): NavBarConfig => {");
        lines.push("  const links: NavBarLink[] = " + objToTS(links, 1) + ";");
        lines.push("  return { links } as NavBarConfig;");
        lines.push("};");
        lines.push("");
        lines.push("export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();");
      } else {
        lines.push("export const navBarConfig: NavBarConfig = { links: [] };");
      }
    } else {
      // Non-Firefly (Mizuki, and single-file platforms like Fuwari)
      const typePath = _typePath(configKey);
      if (_isSingle()) {
        lines.push("export const " + configKey + ": " + _typeName(configKey) + " = " + objToTS(data, 0) + ";");
      } else {
        lines.push('import type { NavBarConfig } from "' + typePath + '";');
        lines.push('import { LinkPreset } from "' + typePath + '";');
        lines.push("");
        lines.push("export const navBarConfig: NavBarConfig = " + objToTS(data, 0));
      }
    }
  },

  sidebarLayoutConfig: function buildSidebar(configKey, data, lines) {
    lines.push('import type { ' + _typeName(configKey) + ' } from "' + _typePath(configKey) + '";');
    lines.push("");
    lines.push("/**");
    lines.push(" * 侧边栏布局配置");
    lines.push(" */");
    lines.push("export const " + configKey + ": " + _typeName(configKey) + " = " + objToTS(data, 0));
  },

  galleryConfig: function buildGallery(configKey, data, lines) {
    const galleryData = JSON.parse(JSON.stringify(data));
    if (galleryData.albums && Array.isArray(galleryData.albums)) {
      galleryData.albums = galleryData.albums.map(function(album) {
        if (typeof album.tags === "string") {
          album.tags = album.tags.split(",").map(function(t) { return t.trim(); }).filter(Boolean);
        }
        return album;
      });
    }
    lines.push('import type { GalleryConfig } from "../types/galleryConfig";');
    lines.push("");
    lines.push("export const galleryConfig: GalleryConfig = " + objToTS(galleryData, 0));
  },

  friendsConfig: function buildFriends(configKey, data, lines) {
    const pageConfig = {};
    const friendsData = data.friends || [];
    for (const k in data) {
      if (k !== "friends") pageConfig[k] = data[k];
    }
    const friendsItems = friendsData.map(function(item) {
      const newItem = {};
      for (const k2 in item) {
        if (k2 === "tags" && typeof item[k2] === "string") {
          newItem[k2] = item[k2].split(",").map(function(t) { return t.trim(); }).filter(Boolean);
        } else if (k2 === "weight") {
          newItem[k2] = Number(item[k2]) || 0;
        } else if (k2 === "enabled") {
          newItem[k2] = item[k2] === true || item[k2] === "true";
        } else {
          newItem[k2] = item[k2];
        }
      }
      return newItem;
    });
    lines.push('import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";');
    lines.push("");
    lines.push("export const friendsPageConfig: FriendsPageConfig = " + objToTS(pageConfig, 0) + ";");
    lines.push("");
    lines.push("export const friends: FriendLink[] = " + objToTS(friendsItems, 0) + ";");
    lines.push("");
    lines.push("export function getEnabledFriends(): FriendLink[] {");
    lines.push("  const enabled = friends.filter(f => f.enabled);");
    lines.push("  if (friendsPageConfig.randomizeSort) {");
    lines.push("    return [...enabled].sort(() => Math.random() - 0.5);");
    lines.push("  }");
    lines.push("  return [...enabled].sort((a, b) => b.weight - a.weight);");
    lines.push("}");
  },
};

/** Fallback: generic builder for configs without a dedicated handler */
function buildDefault(configKey, data, lines) {
  lines.push('import type { ' + _typeName(configKey) + ' } from "' + _typePath(configKey) + '";');
  lines.push("");
  lines.push("export const " + configKey + ": " + _typeName(configKey) + " = " + objToTS(data, 0));
}

// ============================================================
// Main entry: buildConfigTS
// ============================================================

/**
 * Build TypeScript config file content.
 *
 * Multi-file platforms (Firefly, Mizuki):
 *   Returns one config file's TS content. Called once per configKey.
 *
 * Single-file platforms (Fuwari, any new platform with layout: "single"):
 *   Returns the entire merged config.ts content. configKey is ignored.
 */
export function buildConfigTS(configKey, data) {
  const layout = getPlatformLayout();
  const schema = getCurrentSchema();

  // ── Single-file: build all configs at once ──
  if (layout === "single") return buildSingleFileConfigs(schema);

  // ── Multi-file: build one config ──
  const lines = [];
  const handler = BUILDERS[configKey] || buildDefault;
  handler(configKey, data || {}, lines);
  return lines.join("\n") + "\n";
}

// ============================================================
// Single-file platform builder (replaces old buildFuwariAll)
// ============================================================

/**
 * Generates a merged config file for single-file platforms.
 * Reads schema._meta to determine:
 *   - configOrder: which keys and in what order
 *   - runtimeImports: non-type imports (e.g., LinkPreset)
 *   - outputFile: for informational purposes
 *
 * Type imports are auto-derived from platform.js typeImports metadata.
 */
function buildSingleFileConfigs(schema) {
  const meta = schema._meta || {};
  const keys = meta.configOrder || Object.keys(schema).filter(function(k) { return k !== "_meta"; });
  const lines = [];

  // 1. Collect and emit type imports
  const typePath = getTypeImportPath("");
  const seenTypes = {};
  keys.forEach(function(key) {
    seenTypes[_typeName(key)] = true;
  });
  const typeList = Object.keys(seenTypes).sort();
  lines.push("import type {");
  typeList.forEach(function(t) { lines.push("  " + t + ","); });
  lines.push('} from "' + typePath + '";');

  // 2. Runtime imports (e.g., LinkPreset)
  const runtimeImports = meta.runtimeImports || [];
  if (runtimeImports.length > 0) {
    lines.push('import { ' + runtimeImports.join(", ") + ' } from "' + typePath + '";');
  }
  lines.push("");

  // 3. Emit each config
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const data = STATE && STATE.configs ? STATE.configs[key] : {};
    if (data == null || typeof data !== "object") continue;

    // Use the dedicated builder if available
    const handler = BUILDERS[key];
    if (handler) {
      const beforeLen = lines.length;
      handler(key, data || {}, lines);
      continue;
    }

    // Fallback: generate standard export
    lines.push("export const " + key + ": " + _typeName(key) + " = " + objToTS(data, 0) + ";");

    if (i < keys.length - 1) lines.push("");
  }
  return lines.join("\n") + "\n";
}

// ============================================================
// TS Serialization — unified objToTS
// ============================================================

/**
 * Convert a JS value to a TypeScript literal string.
 * Platform-aware: uses getLinkPresetPrefix() for LinkPreset references.
 */
export function objToTS(obj, indent) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") {
    if (obj === "zh_CN" && indent === 0) return "SITE_LANG";
    // LinkPreset references — prefix depends on platform
    if ([
      "Home", "Archive", "About", "Friends", "Anime", "Diary", "Albums",
      "Projects", "Skills", "Timeline", "AITools", "Categories",
      "Tags", "Sponsor", "Guestbook", "Bangumi", "Gallery",
    ].indexOf(obj) >= 0) {
      return _preset() + obj;
    }
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const pad = "\n" + "  ".repeat(indent + 1);
    const items = obj.map(function(v) {
      return pad + objToTS(v, indent + 1);
    });
    return "[" + items.join(",") + "\n" + "  ".repeat(indent) + "]";
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  const pad = "\n" + "  ".repeat(indent + 1);
  const pairs = keys.map(function(k) {
    const val = obj[k];
    if (k === "lang" && val === "zh_CN") return pad + k + ": SITE_LANG";
    return pad + k + ": " + objToTS(val, indent + 1);
  });
  return "{" + pairs.join(",") + "\n" + "  ".repeat(indent) + "}";
}

// ── Attach to window for backward compatibility ──
Object.assign(window, {
  buildConfigTS,
  objToTS,
});
