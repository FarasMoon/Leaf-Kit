// ============================================================
// 配置构建器 — 从 JS 对象生成 TS 代码
// ============================================================
// 平台元数据（布局、类型路径、LinkPreset 前缀）在
// platform.js 中定义，并通过 state.js 辅助函数访问。
// 添加新的 "single-file" 平台（如 Fuwari）只需要：
//   1. 创建 schemas/<platform>.js，包含 _meta 部分
//   2. 在 platform.js 中注册，设置 layout: "single" + typeImports
//   3. 在 state.js 的 getCurrentPlatform() 中注册检测

// ── 平台辅助函数（快捷方式） ──
function _platform() { return (getPlatformLayout() === "single") ? "single" : "multi"; }
function _isSingle() { return _platform() === "single"; }
function _typePath(key) { return getTypeImportPath(key); }
function _typeName(key) { return configKeyToTypeName(key); }
function _preset() { return getLinkPresetPrefix(); }

// ── 策略映射：configKey → 处理函数 ──
// 仅 multi-file 平台使用每个 config 的处理函数。
// Single-file 平台使用 buildSingleFileConfigs()。

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
      // 非 Firefly（Mizuki 以及像 Fuwari 这样的 single-file 平台）
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

/** 回退：无专用处理函数的配置的通用构建器 */
function buildDefault(configKey, data, lines) {
  lines.push('import type { ' + _typeName(configKey) + ' } from "' + _typePath(configKey) + '";');
  lines.push("");
  lines.push("export const " + configKey + ": " + _typeName(configKey) + " = " + objToTS(data, 0));
}

// ============================================================
// 主入口：buildConfigTS
// ============================================================

/**
 * 构建 TypeScript 配置文件内容。
 *
 * Multi-file 平台（Firefly, Mizuki）：
 *   返回一个配置文件的 TS 内容。对每个 configKey 调用一次。
 *
 * Single-file 平台（Fuwari，以及任何 layout: "single" 的新平台）：
 *   返回整个合并的 config.ts 内容。configKey 被忽略。
 */
export function buildConfigTS(configKey, data) {
  const layout = getPlatformLayout();
  const schema = getCurrentSchema();

  // ── Single-file：一次性构建所有配置 ──
  if (layout === "single") return buildSingleFileConfigs(schema);

  // ── Multi-file：构建一个配置 ──
  const lines = [];
  const handler = BUILDERS[configKey] || buildDefault;
  handler(configKey, data || {}, lines);
  return lines.join("\n") + "\n";
}

// ============================================================
// Single-file 平台构建器（取代旧的 buildFuwariAll）
// ============================================================

/**
 * 为 single-file 平台生成合并的配置文件。
 * 读取 schema._meta 来确定：
 *   - configOrder：哪些键以及顺序
 *   - runtimeImports：非类型导入（如 LinkPreset）
 *   - outputFile：仅供参考
 *
 * 类型导入从 platform.js 的 typeImports 元数据自动派生。
 */
function buildSingleFileConfigs(schema) {
  const meta = schema._meta || {};
  const keys = meta.configOrder || Object.keys(schema).filter(function(k) { return k !== "_meta"; });
  const lines = [];

  // 1. 收集并输出类型导入
  const typePath = getTypeImportPath("");
  const seenTypes = {};
  keys.forEach(function(key) {
    seenTypes[_typeName(key)] = true;
  });
  const typeList = Object.keys(seenTypes).sort();
  lines.push("import type {");
  typeList.forEach(function(t) { lines.push("  " + t + ","); });
  lines.push('} from "' + typePath + '";');

  // 2. 运行时导入（如 LinkPreset）
  const runtimeImports = meta.runtimeImports || [];
  if (runtimeImports.length > 0) {
    lines.push('import { ' + runtimeImports.join(", ") + ' } from "' + typePath + '";');
  }
  lines.push("");

  // 3. 输出每个配置
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const data = STATE && STATE.configs ? STATE.configs[key] : {};
    if (data == null || typeof data !== "object") continue;

    // 如果有专用构建器则使用
    const handler = BUILDERS[key];
    if (handler) {
      const beforeLen = lines.length;
      handler(key, data || {}, lines);
      continue;
    }

    // 回退：生成标准导出
    lines.push("export const " + key + ": " + _typeName(key) + " = " + objToTS(data, 0) + ";");

    if (i < keys.length - 1) lines.push("");
  }
  return lines.join("\n") + "\n";
}

// ============================================================
// TS 序列化 — 统一的 objToTS
// ============================================================

/**
 * 将 JS 值转换为 TypeScript 字面量字符串。
 * 平台感知：使用 getLinkPresetPrefix() 处理 LinkPreset 引用。
 */
export function objToTS(obj, indent) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") {
    if (obj === "zh_CN" && indent === 0) return "SITE_LANG";
    // LinkPreset 引用 — 前缀取决于平台
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

// ── 挂载到 window 以保证向后兼容 ──
Object.assign(window, {
  buildConfigTS,
  objToTS,
});
