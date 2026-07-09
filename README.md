![LeafKit-Logo](src/image/logo.png)

<div align="center">

<img src="https://img.shields.io/badge/node-18%2B-green.svg" alt="node">
<img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license">
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">

<br>
<br>

<a href="#快速开始">快速开始</a> ｜
<a href="#支持的博客平台">支持的平台</a> ｜
<a href="#主要功能">主要功能</a> ｜
<a href="#技术栈">技术栈</a> ｜
<a href="#贡献">贡献</a>

</div>

LeafKit 是一个可视化的博客配置与文章编辑器，专为基于 Astro 的博客主题设计。它提供丰富的表单化界面，让你无需手动编辑 TypeScript 配置文件，即可直观地管理博客的配置、文章和图片资源。支持 Firefly、Mizuki、Fuwari 三款主流 Astro 博客主题。

## 主要功能

1. 🎨 **可视化配置编辑** — 动态表单卡片，告别手写 TypeScript 配置文件。
2. 📝 **文章管理** — 支持 Markdown 文章的创建、编辑、预览和删除，内置分栏实时预览。
3. 🖼️ **图片管理** — 壁纸、图库、头像等图片资源的上传与管理，支持缩略图预览。
4. 🌓 **明暗主题** — 内置亮色/暗色主题，支持自定义主题色。
5. 🔍 **平台自动检测** — 自动识别博客项目所使用的主题平台。
6. 🌐 **本地预览** — 一键启动 `pnpm dev` 本地预览服务器，实时查看博客效果。
7. 🚀 **Git 推送** — 内置 Git 部署功能，通过 SSH 将博客推送到远程仓库。
8. 💾 **自动保存** — 编辑文章时自动保存，防止数据丢失。
9. 🔧 **JSON 编辑器** — 提供原始 JSON 编辑模式，满足高级用户需求。
10. 📦 **零依赖** — 纯 Node.js + 原生浏览器 API，无需安装任何前端框架或构建工具。

<br>

<table align="center">
  <tr align="center">
    <th>🎨 Firefly 配置编辑</th>
    <th>💗 Mizuki 配置编辑</th>
  </tr>
  <tr>
    <td align="center"><img width="480" alt="firefly" src="src/image/f1.png" /></td>
    <td align="center"><img width="480" alt="mizuki" src="src/image/m1.png" /></td>
  </tr>
</table>

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18 或更高版本
- 一个基于 Firefly / Mizuki / Fuwari 主题的 Astro 博客项目

### 启动

```bash
# 克隆项目
git clone <your-repo-url>
cd blog-editor

# 启动服务
node server.cjs
```

或者直接双击运行 `start.bat`（Windows）。

服务默认运行在 `http://localhost:6299`，在浏览器中打开即可使用。

> 首次使用时，浏览器会弹出文件夹选择对话框，请选择你的 Astro 博客项目根目录。之后会自动记住选择（基于 IndexedDB）。

### 使用流程

1. 打开 `http://localhost:6299`
2. 选择你的 Astro 博客项目文件夹
3. LeafKit 会自动检测博客平台（Firefly / Mizuki / Fuwari），也可手动切换
4. 在左侧边栏选择要编辑的配置项或进入文章管理
5. 编辑完成后点击保存，配置将写回原始 `.ts` 文件
6. 点击顶部"预览"按钮启动本地预览服务器
7. 点击"推送"按钮将更改部署到 GitHub

## 支持的博客平台

| 平台 | 主题色 | 配置布局 | 文档 |
|------|--------|----------|------|
| **Firefly** | 绿色 `#17824b` | 多文件配置 | [文档](https://docs.astrbot.app/) |
| **Mizuki** | 粉色 `#e91e63` | 多文件配置 | [文档](https://docs.astrbot.app/) |
| **Fuwari** | 蓝紫色 `#6080d0` | 单文件配置 | [文档](https://docs.astrbot.app/) |

## 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Node.js (原生 http 模块) |
| **前端** | Vanilla JavaScript (ES Modules) |
| **样式** | CSS Custom Properties (动态主题) |
| **文件访问** | File System Access API / 服务端 API |
| **持久化** | IndexedDB + localStorage |
| **Markdown** | marked.js (CDN) |

## 项目结构

```
blog-editor/
├── server.cjs              # 入口文件
├── start.bat               # Windows 启动脚本
├── package.json
├── server/
│   ├── index.js            # HTTP 服务主逻辑
│   ├── shared.js           # 共享工具函数
│   ├── multipart.js        # 文件上传解析
│   ├── api-file.js         # 文件读写 API
│   ├── api-git.js          # Git 推送 API
│   └── api-preview.js      # 预览服务 API
└── src/
    ├── index.html          # 主界面 (SPA)
    ├── image/              # 图片资源
    ├── styles/
    │   └── main.css        # 全局样式
    └── js/
        ├── UI.js           # 模块聚合入口
        ├── state.js        # 状态管理
        ├── parser.js       # TS 配置解析器
        ├── builder.js      # TS 代码生成器
        ├── platform.js     # 平台元数据
        ├── filesystem.js   # 文件系统访问
        ├── articles.js     # 文章管理
        ├── publish.js      # 预览 & Git 推送
        ├── settings.js     # 用户设置
        ├── sidebar.js      # 侧边栏
        ├── toast.js        # 消息通知
        └── ...
```

## 贡献

欢迎提交 Issues 和 Pull Requests！

### 开发指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个 Pull Request

## 许可证

本项目基于 MIT 许可证开源。详见 [LICENSE](LICENSE) 文件。

<br>

<div align="center">

_让博客配置像叶子一样轻盈。_

</div>
