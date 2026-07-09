// ============================================================
// Platform Configuration — unified platform metadata & logic
// Attaches to window for global access.
// ============================================================

const PLATFORMS = {
  mizuki: {
    name: "Mizuki",
    accent: "#e91e63",
    hue: 340,
    layout: "multi",                 // 每 configKey 一个独立 .ts 文件
    linkPresetPrefix: "LinkPreset.", // import { LinkPreset } from "../types/config"
    typeImports: { defaultPath: "../types/config" },
    docs: {
      _getting_started: "https://docs.mizuki.mysqil.com/guide/get-started/",
      siteConfig: "https://docs.mizuki.mysqil.com/Basic-Layout/layout/banner/",
      fullscreenWallpaperConfig: "https://docs.mizuki.mysqil.com/Basic-Layout/layout/fullscreen/",
      sidebarLayoutConfig: "https://docs.mizuki.mysqil.com/Basic-Layout/layout/hide/",
      navBarConfig: "https://docs.mizuki.mysqil.com/Basic-Layout/navBarConfig/",
    },
  },
  firefly: {
    name: "Firefly",
    accent: "#17824b",
    hue: 165,
    layout: "multi",                // 每 configKey 一个独立 .ts 文件
    linkPresetPrefix: "LinkPresets.", // import { LinkPresets } from ...
    typeImports: {
      defaultPath: "../types/config",
      overrides: {
        siteConfig:    "@/types/siteConfig",
        profileConfig: "../types/profileConfig",
        sidebarLayoutConfig: "../types/sidebarConfig",
        navBarConfig:  "../types/navBarConfig",
        galleryConfig: "../types/galleryConfig",
      },
    },
    docs: {
      _getting_started: "https://docs-firefly.cuteleaf.cn/zh/guide/getting-started.html",
      siteConfig: "https://docs-firefly.cuteleaf.cn/zh/guide/site.html",
      profileConfig: "https://docs-firefly.cuteleaf.cn/zh/guide/profile.html",
      fullscreenWallpaperConfig: "https://docs-firefly.cuteleaf.cn/zh/guide/wallpaper.html",
      navBarConfig: "https://docs-firefly.cuteleaf.cn/zh/guide/navbar.html",
      plantumlConfig: "https://docs-firefly.cuteleaf.cn/zh/guide/plantuml.html",
      friendsConfig: "https://docs-firefly.cuteleaf.cn/zh/guide/friends.html",
    },
  },
  fuwari: {
    name: "Fuwari",
    accent: "#6080d0",
    hue: 250,
    layout: "single",               // 所有 config 合并到一个 src/config.ts
    linkPresetPrefix: "LinkPreset.", // import { LinkPreset } from "./types/config"
    typeImports: { defaultPath: "./types/config" },
    docs: {
      _getting_started: "https://fuwari.vercel.app/",
      siteConfig: "https://fuwari.vercel.app/",
    },
  },
};
