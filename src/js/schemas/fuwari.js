// ============================================================
// Fuwari Platform Config Schema
// ============================================================
const FUWARI_CONFIG_SCHEMA = {
  // ── Platform meta: used by builder.js to auto-generate imports & types ──
  _meta: {
    outputFile: "src/config.ts",
    runtimeImports: ["LinkPreset"], // non-type imports
    configOrder: [
      "siteConfig",
      "navBarConfig",
      "profileConfig",
      "licenseConfig",
      "expressiveCodeConfig",
    ],
  },

  siteConfig: C("src/config.ts", "网站核心配置：标题、语言、主题色、Banner、目录、网站图标", "站点配置", [
    F.txt("title", "站点标题", { section: "basic", desc: "显示在浏览器标签页的网站名称" }),
    F.txt("subtitle", "副标题", { section: "basic", desc: "标题下方的简短描述语" }),
    F.sel("lang", "语言", ["en","zh_CN","zh_TW","ja","ko","es","th","vi","tr","id"], { section: "basic", desc: "网站界面的默认显示语言" }),
    F.range("themeColor.hue", "主题色相(0-360)", 0, 360, { section: "theme", desc: "主题色在色环上的位置" }),
    F.chk("themeColor.fixed", "固定主题色", { section: "theme", desc: "开启后将隐藏访客的主题色选择器" }),
    F.chk("banner.enable", "启用Banner", { section: "banner" }),
    F.txt("banner.src", "Banner图片路径", { section: "banner", desc: "相对于 /src 目录" }),
    F.sel("banner.position", "Banner位置", ["top","center","bottom"], { section: "banner" }),
    F.chk("banner.credit.enable", "显示图片来源", { section: "banner" }),
    F.txt("banner.credit.text", "来源文字", { section: "banner" }),
    F.txt("banner.credit.url", "来源链接", { section: "banner" }),
    F.chk("toc.enable", "启用目录", { section: "content", desc: "文章页面右侧显示目录" }),
    F.num("toc.depth", "目录深度", { min: 1, max: 3, section: "content", desc: "1-3级标题" }),
    F.txt("favicon.src", "网站图标路径", { section: "basic", desc: "相对于 /src 目录" }),
  ]),

  navBarConfig: CA("src/config.ts", "导航菜单配置：网站顶部导航栏的链接和排序", "导航栏", [], A("links", "导航链接", [
    F.txt("name", "名称", { labelShort: "名", placeholder: "菜单名称", sizeClass: "field-m" }),
    F.txt("url", "链接", { labelShort: "链", placeholder: "/path/ 或 https://...", sizeClass: "field-m" }),
    F.chk("external", "外链", { labelShort: "外" }),
  ], { linkPresets: ["Home","Archive","About"] })),

  profileConfig: CA("src/config.ts", "个人信息：头像、昵称、个人简介和社交链接", "个人资料", [
    F.img("avatar", "头像路径", "public/images", { desc: "相对于 /src 目录" }),
    F.txt("name", "昵称", { desc: "显示在页面中的用户名称" }),
    F.area("bio", "个人简介", { desc: "简短的个人介绍" }),
  ], A("links", "社交链接", [
    F.txt("name", "名称", { placeholder: "GitHub", sizeClass: "field-m" }),
    F.txt("url", "链接", { placeholder: "https://...", sizeClass: "field-m" }),
    F.txt("icon", "图标", { placeholder: "fa6-brands:github", sizeClass: "field-m" }),
  ])),

  licenseConfig: C("src/config.ts", "许可证：网站内容许可协议和版权声明", "许可证", [
    F.chk("enable", "启用许可证"),
    F.txt("name", "许可证名称"),
    F.txt("url", "许可证URL"),
  ]),

  expressiveCodeConfig: C("src/config.ts", "代码块样式：文章中代码高亮的主题", "代码块样式", [
    F.sel("theme", "代码主题", ["github-dark","github-light","monokai","dracula"]),
  ]),
};

window.FUWARI_CONFIG_SCHEMA = FUWARI_CONFIG_SCHEMA;
