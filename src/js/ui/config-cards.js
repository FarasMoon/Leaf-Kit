// ============================================================
// 配置卡片 UI — buildConfigUI, getSectionLabel
// ============================================================

import { buildConfigTS } from "../builder.js";
// parser.js 作为常规脚本加载 — 从 window 获取
const { getConfigValue, getNestedValue, setNestedValue } = window;
import {
  renderTreeEditor,
  createTreeNode,
  fieldLabel,
  buildFieldInput,
  buildAddRow,
  renderTreeNodes,
  markTreeDirty,
} from "./tree-editor.js";
import { renderImageField } from "./image-preview.js";
import { syncJsonEditor, updateStatusDot } from "./shared-ui.js";
import { saveSingleConfig } from "./save.js";
import { buildWallpaperSection } from "./wallpaper.js";
import { loadGalleryImages } from "./gallery.js";
import { uploadMultipleImages } from "./upload.js";

export function getSectionLabel(sec) {
  const map = {
    basic: "基本信息",
    theme: "主题设置",
    features: "功能页面",
    navbar: "导航栏",
    wallpaper: "壁纸设置",
    layout: "布局设置",
    content: "内容设置",
    post: "文章设置",
    ui: "界面设置",
    image: "图片优化",
    integrations: "集成服务",
    advanced: "高级设置",
    main: "",
  };
  return map[sec] || sec;
}

export function buildConfigUI() {
  const container = document.getElementById("configCards");
  const navContainer = document.getElementById("navConfigItems");
  container.innerHTML = "";
  navContainer.innerHTML = "";

  for (const [key, schema] of Object.entries(getCurrentSchema())) {
    // 导航子项
    const desc = schema.desc || "";
    const navItem = document.createElement("button");
    navItem.className = "nav-sub-item";
    navItem.title = desc;
    navItem.innerHTML = `<span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${schema.label}</span>`;
    navItem.onclick = () => {
      switchPanel("config");
      navContainer
        .querySelectorAll(".nav-sub-item")
        .forEach((b) => b.classList.remove("active"));
      navItem.classList.add("active");
      const card = document.getElementById("configCard-" + key);
      if (card) {
        card.scrollIntoView({ behavior: "smooth" });
      }
    };
    navContainer.appendChild(navItem);

    // 卡片
    const card = document.createElement("div");
    card.className = "card";
    card.id = "configCard-" + key;
    card.style.marginBottom = "16px";

    const fields = schema.fields || [];
    const configData = STATE.configs[key];
    const isRawString = typeof configData === "string";

    // 头部
    const docUrl = typeof getDocUrl === "function" ? getDocUrl(key) : null;
    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
    <span class="arrow">▼</span>
    <h3>${schema.label}</h3>
    ${desc ? `<span style="font-size:11px;color:var(--text2);margin-left:8px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:1;min-width:0">${desc}</span>` : ""}
    ${docUrl ? `<a href="${docUrl}" target="_blank" rel="noopener" title="查看文档" style="font-size:11px;color:var(--accent);text-decoration:none;margin-left:6px;pointer-events:auto" onclick="event.stopPropagation()">[文档]</a>` : ""}
    <span style="font-size:11px;color:var(--text3);margin-left:auto;margin-right:12px;flex-shrink:0">${schema.file}</span>
    <button class="btn btn-primary btn-sm" style="pointer-events:auto;flex-shrink:0" onclick="event.stopPropagation();saveSingleConfig('${key}')">保存</button>
  `;

    // 主体
    const body = document.createElement("div");
    body.className = "card-body";

    // 表单字段
    if (fields.length > 0) {
      const sections = {};
      for (const f of fields) {
        const sec = f.section || "main";
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(f);
      }

      for (const [sec, secFields] of Object.entries(sections)) {
        if (sec !== "main") {
          const secDiv = document.createElement("div");
          secDiv.className = "form-section";
          const secLabel = document.createElement("span");
          secLabel.className = "form-section-label";
          secLabel.textContent = getSectionLabel(sec);
          secDiv.appendChild(secLabel);
          body.appendChild(secDiv);
        }

        const grid = document.createElement("div");
        grid.className = "form-grid";
        grid.style.marginBottom = "12px";

        for (const f of secFields) {
          const group = document.createElement("div");
          group.className =
            "form-group" + (f.type === "textarea" ? " form-full" : "");

          if (f.type === "checkbox") {
            group.classList.add("checkbox-label");
            const toggleWrap = document.createElement("label");
            toggleWrap.className = "toggle";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.id = `cfg-${key}-${f.key.replace(/\./g, "_")}`;
            const val = getConfigValue(key, [f]);
            input.checked = !!val[f.key];
            input.onchange = () => {
              setNestedValue(STATE.configs[key], f.key, input.checked);
              STATE.modifiedConfigs.add(key);
              updateStatusDot();
              syncJsonEditor(key);
            };
            const slider = document.createElement("span");
            slider.className = "slider";
            toggleWrap.appendChild(input);
            toggleWrap.appendChild(slider);
            const label = document.createElement("span");
            label.textContent = f.label;
            if (f.desc) label.title = f.desc;
            label.className = "check-text";
            label.onclick = function () { input.click(); };
            group.appendChild(toggleWrap);
            group.appendChild(label);
          } else if (f.type === "select") {
            const label = document.createElement("label");
            label.textContent = f.label;
            if (f.desc) label.title = f.desc;
            const input = document.createElement("select");
            input.id = `cfg-${key}-${f.key.replace(/\./g, "_")}`;
            f.options.forEach((opt) => {
              const o = document.createElement("option");
              o.value = opt;
              o.textContent = opt;
              input.appendChild(o);
            });
            const val = getConfigValue(key, [f]);
            input.value = String(val[f.key] ?? "");
            input.onchange = () => {
              setNestedValue(STATE.configs[key], f.key, input.value);
              STATE.modifiedConfigs.add(key);
              updateStatusDot();
              syncJsonEditor(key);
            };
            group.appendChild(label);
            group.appendChild(input);
          } else if (f.type === "range") {
            const label = document.createElement("label");
            label.textContent = f.label;
            if (f.desc) label.title = f.desc;
            const row = document.createElement("div");
            row.className = "range-row";
            const input = document.createElement("input");
            input.type = "range";
            input.min = f.min ?? 0;
            input.max = f.max ?? 100;
            input.step = f.step || 1;
            input.id = `cfg-${key}-${f.key.replace(/\./g, "_")}`;
            const valDisplay = document.createElement("span");
            valDisplay.className = "range-val";
            const val = getConfigValue(key, [f]);
            input.value = val[f.key] ?? 0;
            valDisplay.textContent = input.value;
            const hasSwatch =
              f.key.toLowerCase().indexOf("hue") >= 0 ||
              f.key.toLowerCase().indexOf("color") >= 0;
            let swatch = null;
            if (hasSwatch) {
              swatch = document.createElement("span");
              swatch.className = "range-swatch";
              const hue = parseInt(input.value);
              swatch.style.background = "hsl(" + hue + ", 85%, 50%)";
            }
            input.oninput = () => {
              valDisplay.textContent = input.value;
              if (swatch) {
                const h = parseInt(input.value);
                swatch.style.background = "hsl(" + h + ", 85%, 50%)";
              }
              setNestedValue(
                STATE.configs[key],
                f.key,
                parseInt(input.value),
              );
              STATE.modifiedConfigs.add(key);
              updateStatusDot();
              syncJsonEditor(key);
            };
            group.appendChild(label);
            row.appendChild(input);
            row.appendChild(valDisplay);
            if (swatch) row.appendChild(swatch);
            group.appendChild(row);
          } else if (f.type === "image") {
            const label = document.createElement("label");
            label.textContent = f.label;
            if (f.desc) label.title = f.desc;
            group.appendChild(label);
            const uploadDiv = document.createElement("div");
            uploadDiv.className = "img-upload";
            uploadDiv.id = `img-upload-${key}-${f.key.replace(/\./g, "_")}`;
            uploadDiv._pendingImage = { key: key, field: f, containerId: uploadDiv.id };
            group.appendChild(uploadDiv);
          } else {
            const label = document.createElement("label");
            label.textContent = f.label;
            if (f.desc) label.title = f.desc;
            const isTextarea = f.type === "textarea";
            const input = isTextarea
              ? document.createElement("textarea")
              : document.createElement("input");
            if (!isTextarea) {
              if (f.type === "number") input.type = "number";
              else if (f.type === "date") input.type = "date";
              else input.type = "text";
              if (f.min != null) input.min = f.min;
              if (f.max != null) input.max = f.max;
              if (f.step != null) input.step = f.step;
            }
            input.placeholder = f.label;
            input.id = `cfg-${key}-${f.key.replace(/\./g, "_")}`;
            const val = getConfigValue(key, [f]);
            if (f.type === "number") input.value = val[f.key] ?? "";
            else
              input.value = val[f.key] != null ? String(val[f.key]) : "";
            input.oninput = () => {
              const v =
                f.type === "number"
                  ? input.value === ""
                    ? ""
                    : Number(input.value)
                  : input.value;
              setNestedValue(STATE.configs[key], f.key, v);
              STATE.modifiedConfigs.add(key);
              updateStatusDot();
              syncJsonEditor(key);
            };
            group.appendChild(label);
            group.appendChild(input);
          }
          grid.appendChild(group);
        }
        body.appendChild(grid);
      }
    }

    // 基于数组的配置的树形编辑器（单个数组）
    if (
      schema.arrayFields &&
      configData &&
      typeof configData === "object"
    ) {
      const treeSchema = schema.arrayFields;
      let arrayData = configData[treeSchema.rootKey];
      // 初始化缺失的数组，使"添加"按钮始终显示
      if (!Array.isArray(arrayData)) {
        arrayData = [];
        configData[treeSchema.rootKey] = arrayData;
      }
      const treeContainer = document.createElement("div");
      treeContainer.className = "tree-editor";
      if (treeSchema.label) {
        const labelEl = document.createElement("div");
        labelEl.className = "tree-section-label";
        labelEl.textContent =
          treeSchema.label + " (" + arrayData.length + ")";
        treeContainer.appendChild(labelEl);
      }
      renderTreeEditor(key, arrayData, treeSchema, treeContainer);
      body.appendChild(treeContainer);
    }

    // 基于数组的配置的树形编辑器（多个数组）
    if (
      schema.arrayFieldsList &&
      configData &&
      typeof configData === "object"
    ) {
      schema.arrayFieldsList.forEach(function (treeSchema) {
        let arrayData = configData[treeSchema.rootKey];
        if (!Array.isArray(arrayData)) arrayData = [];
        const treeContainer = document.createElement("div");
        treeContainer.className = "tree-editor";
        treeContainer.style.marginBottom = "12px";
        if (treeSchema.label) {
          const labelEl = document.createElement("div");
          labelEl.className = "tree-section-label";
          labelEl.textContent =
            treeSchema.label + " (" + arrayData.length + ")";
          treeContainer.appendChild(labelEl);
        }
        renderTreeEditor(key, arrayData, treeSchema, treeContainer);
        body.appendChild(treeContainer);
      });
    }

    // Gallery: 每个相册的图片管理
    if (key === "galleryConfig" && configData && typeof configData === "object") {
      // 总体上传辅助（用于封面图，不用于相册照片）
      const glSection = document.createElement("div");
      glSection.className = "form-section";
      glSection.style.marginTop = "12px";
      const glLabel = document.createElement("span");
      glLabel.className = "form-section-label";
      glLabel.textContent = "相册封面图片上传";
      glSection.appendChild(glLabel);
      const glGrid = document.createElement("div");
      glGrid.className = "form-grid";
      glGrid.style.marginBottom = "8px";
      const glGroup = document.createElement("div");
      glGroup.className = "form-group";
      const glBtn = document.createElement("button");
      glBtn.className = "btn btn-primary btn-sm";
      glBtn.textContent = "上传相册封面";
      glBtn.style.marginTop = "4px";
      glBtn.onclick = function () {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*";
        inp.multiple = true;
        inp.onchange = function () {
          const files = this.files;
          if (!files || files.length === 0) return;
          uploadMultipleImages(Array.from(files), "public/images/gallery").then(function (paths) {
            if (paths.length > 0) {
              showToast("已上传 " + paths.length + " 张封面图片，路径已复制到剪贴板", "success");
              navigator.clipboard.writeText(paths.join("\n")).catch(function () {});
            }
          });
        };
        inp.click();
      };
      glGroup.appendChild(glBtn);
      const glHint = document.createElement("span");
      glHint.className = "gallery-hint";
      glHint.textContent = "上传到 public/images/gallery/，路径复制到剪贴板，可粘贴到上方相册的「封面图路径」字段";
      glGroup.appendChild(glHint);
      glGrid.appendChild(glGroup);
      glSection.appendChild(glGrid);
      body.appendChild(glSection);
    }

    // 壁纸图片管理（桌面端 + 移动端）
    if (key === "fullscreenWallpaperConfig" && configData && typeof configData === "object") {
      if (!configData.src || typeof configData.src !== "object" || Array.isArray(configData.src)) {
        configData.src = { desktop: [], mobile: [] };
      }
      if (!Array.isArray(configData.src.desktop)) configData.src.desktop = [];
      if (!Array.isArray(configData.src.mobile)) configData.src.mobile = [];

      body.appendChild(buildWallpaperSection(
        "桌面端壁纸 (src.desktop)",
        configData.src.desktop,
        "public/images/wallpaper/desktop",
        key,
        () => buildConfigUI()
      ));
      body.appendChild(buildWallpaperSection(
        "移动端壁纸 (src.mobile)",
        configData.src.mobile,
        "public/images/wallpaper/mobile",
        key,
        () => buildConfigUI()
      ));
    }

    // JSON 编辑器
    const jsonDiv = document.createElement("div");
    jsonDiv.className = "json-editor";
    jsonDiv.style.marginTop = "12px";
    jsonDiv.innerHTML = `
    <div class="json-editor-header">
      <span>JSON 代码</span>
      <button class="btn btn-secondary btn-sm" style="margin-left:auto" onclick="applyJsonFromEditor('${key}')">从JSON更新表单</button>
      <button class="btn btn-secondary btn-sm" onclick="copyJson('${key}')">复制</button>
    </div>
    <textarea id="json-editor-${key}" oninput="STATE.modifiedConfigs.add('${key}');updateStatusDot()"></textarea>
  `;
    body.appendChild(jsonDiv);

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);

    // 初始化 JSON 编辑器
    syncJsonEditor(key);
  }

  // 现在展开手风琴菜单，配置项已加载
  const accordionBtn = document.querySelector(".nav-accordion");
  const accordionBody = document.getElementById("navConfigItems");
  if (accordionBtn && accordionBody && accordionBody.children.length > 0) {
    accordionBtn.classList.remove("collapsed");
    accordionBody.classList.remove("collapsed");
  }

  // 渲染所有延迟加载的图片字段
  const pendingImages = container.querySelectorAll("[id^='img-upload-']");
  for (const div of pendingImages) {
    if (div._pendingImage) {
      const { key, field, containerId } = div._pendingImage;
      const val = getConfigValue(key, [field]);
      const currentPath = val[field.key] != null ? String(val[field.key]) : "";
      renderImageField(key, field, currentPath, containerId);
    }
  }
}
