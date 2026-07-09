// ============================================================
// Tree Editor — card-based recursive array editor
// ============================================================

// parser.js is loaded as a regular script — grab from window
const { setNestedValue } = window;
import { updateStatusDot, syncJsonEditor } from "./shared-ui.js";
import { loadGalleryImages } from "./gallery.js";

export function renderTreeEditor(configKey, arrayData, treeSchema, container) {
  container.innerHTML = "";
  if (!Array.isArray(arrayData)) return;
  const rootEl = document.createElement("div");
  rootEl.className = "tree-root";
  renderTreeNodes(configKey, arrayData, treeSchema, rootEl);
  container.appendChild(rootEl);

  // Add row at root
  const addRow = buildAddRow(configKey, treeSchema, arrayData, container);
  container.appendChild(addRow);
}

export function createTreeNode(nodeFields, childrenKey) {
  const obj = {};
  nodeFields.forEach(function (f) {
    if (f.type === "checkbox") obj[f.key] = false;
    else if (f.type === "number") obj[f.key] = 0;
    else obj[f.key] = "";
  });
  if (childrenKey) obj[childrenKey] = [];
  return obj;
}

export function fieldLabel(f) {
  return f.labelShort || f.label.charAt(0);
}

export function buildFieldInput(item, f, configKey) {
  const val =
    item[f.key] != null ? item[f.key] : f.type === "number" ? 0 : "";
  if (f.type === "checkbox") {
    const wrap = document.createElement("label");
    wrap.className = "field-check-label";
    const toggleWrap = document.createElement("span");
    toggleWrap.className = "toggle";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    if (val) inp.checked = true;
    const slider = document.createElement("span");
    slider.className = "slider";
    toggleWrap.appendChild(inp);
    toggleWrap.appendChild(slider);
    const txt = document.createElement("span");
    txt.textContent = f.label;
    txt.style.cssText = "font-size:13px;line-height:22px";
    txt.onclick = function () { inp.click(); };
    inp.onchange = function () {
      item[f.key] = this.checked;
      markTreeDirty(configKey);
    };
    wrap.appendChild(toggleWrap);
    wrap.appendChild(txt);
    return wrap;
  }
  if (f.type === "select" && f.options) {
    const sel = document.createElement("select");
    f.options.forEach(function (o) {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      if (String(val) === String(o)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = function () {
      item[f.key] = this.value;
      markTreeDirty(configKey);
    };
    return sel;
  }
  if (f.type === "image") {
    const wrap = document.createElement("div");
    wrap.className = "tree-field-image-wrap";
    // Avatar preview thumbnail
    const preview = document.createElement("img");
    preview.className = "tree-field-avatar-preview";
    preview.alt = "";
    const currentUrl = val || "";
    if (currentUrl) {
      if (/^https?:\/\//.test(currentUrl) || /^blob:/.test(currentUrl)) {
        preview.src = currentUrl;
      } else if (STATE.projectDir) {
        // Try to resolve local path as blob
        readProjectImageAsBlob(currentUrl).then(function (blobUrl) {
          if (blobUrl) { preview.src = blobUrl; preview.style.display = ""; }
        });
      }
    }
    if (!preview.src || preview.src === window.location.href) {
      preview.style.display = "none";
    }
    preview.onerror = function () { this.style.display = "none"; };
    wrap.appendChild(preview);
    // URL input
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = f.sizeClass || "";
    inp.placeholder = f.placeholder || f.label;
    inp.value = currentUrl;
    inp.oninput = function () {
      item[f.key] = this.value;
      markTreeDirty(configKey);
      // Update preview on change
      const v = this.value.trim();
      if (v && (/^https?:\/\//.test(v) || /^blob:/.test(v))) {
        preview.src = v;
        preview.style.display = "";
      } else if (v && STATE.projectDir) {
        readProjectImageAsBlob(v).then(function (blobUrl) {
          if (blobUrl) { preview.src = blobUrl; preview.style.display = ""; }
        });
      } else {
        preview.style.display = "none";
      }
    };
    wrap.appendChild(inp);
    return wrap;
  }
  const inp = document.createElement("input");
  inp.type = f.type === "number" ? "number" : "text";
  inp.className = f.sizeClass || "";
  inp.placeholder = f.placeholder || f.label;
  inp.value = val;
  inp.oninput = function () {
    const v = f.type === "number" ? Number(this.value) : this.value;
    item[f.key] = v;
    markTreeDirty(configKey);
  };
  return inp;
}

export function buildAddRow(
  configKey,
  treeSchema,
  arrayData,
  container,
  parentItem,
) {
  const addRow = document.createElement("div");
  addRow.className = "tree-add-row";
  addRow.innerHTML =
    '<button class="tree-btn add">+ ' +
    (parentItem ? "添加子项" : "添加项目") +
    "</button>";

  if (treeSchema.linkPresets && treeSchema.linkPresets.length) {
    const sep = document.createElement("span");
    sep.className = "tree-presets-label";
    sep.textContent = "预设:";
    addRow.appendChild(sep);
    const presetsDiv = document.createElement("span");
    presetsDiv.className = "tree-presets";
    treeSchema.linkPresets.forEach(function (p) {
      const pbtn = document.createElement("button");
      pbtn.className = "tree-btn";
      pbtn.textContent = p;
      pbtn.onclick = function () {
        let target = parentItem
          ? parentItem[treeSchema.childrenKey]
          : arrayData;
        if (!Array.isArray(target)) {
          if (parentItem) parentItem[treeSchema.childrenKey] = [];
          target = parentItem[treeSchema.childrenKey];
        }
        target.push(p);
        markTreeDirty(configKey);
        renderTreeEditor(configKey, arrayData, treeSchema, container);
      };
      presetsDiv.appendChild(pbtn);
    });
    addRow.appendChild(presetsDiv);
  }

  addRow.querySelector(".tree-btn.add").onclick = function () {
    const target = parentItem
      ? parentItem[treeSchema.childrenKey]
      : arrayData;
    if (!Array.isArray(target)) {
      if (parentItem) parentItem[treeSchema.childrenKey] = [];
    }
    target.push(
      createTreeNode(treeSchema.nodeFields, treeSchema.childrenKey),
    );
    markTreeDirty(configKey);
    renderTreeEditor(configKey, arrayData, treeSchema, container);
  };
  return addRow;
}

export function renderTreeNodes(configKey, arrayData, treeSchema, container) {
  // loadGalleryImages is imported lazily to break circular dependency
  // with config-cards.js which imports tree-editor.js
  arrayData.forEach(function (item, idx) {
    const isString = typeof item === "string";
    const hasChildren =
      !isString &&
      treeSchema.childrenKey &&
      Array.isArray(item[treeSchema.childrenKey]) &&
      item[treeSchema.childrenKey].length > 0;
    const node = document.createElement("div");
    node.className = "tree-node" + (isString ? " tree-node-preset" : "");
    node.setAttribute("data-idx", idx);

    const card = document.createElement("div");
    card.className = "tree-node-card";

    // Toggle button
    const toggle = document.createElement("span");
    toggle.className =
      "tree-toggle" +
      (!treeSchema.childrenKey || isString ? " hidden" : "");
    toggle.textContent = "▼";
    toggle.onclick = function () {
      const childrenEl = node.querySelector(".tree-node-children");
      if (childrenEl) {
        const collapsed = childrenEl.classList.toggle("collapsed");
        toggle.textContent = collapsed ? "▶" : "▼";
      }
    };
    card.appendChild(toggle);

    // Prefix badge (name or preset label)
    const prefix = document.createElement("span");
    prefix.className = "tree-node-prefix";
    if (isString) {
      prefix.textContent = item;
    } else {
      const nameField = treeSchema.nodeFields.find(function (f) {
        return f.key === "name" || f.key === "type";
      });
      prefix.textContent = nameField
        ? item[nameField.key] || "(未命名)"
        : "(项目)";
    }
    card.appendChild(prefix);

    // Fields area
    if (!isString) {
      const fieldsDiv = document.createElement("div");
      fieldsDiv.className = "tree-fields";
      let rowEl;
      treeSchema.nodeFields.forEach(function (f, fi) {
        if (f.type === "checkbox") {
          const row = document.createElement("div");
          row.className = "tree-field-row";
          row.appendChild(buildFieldInput(item, f, configKey));
          fieldsDiv.appendChild(row);
          return;
        }
        if (fi % 2 === 0) {
          rowEl = document.createElement("div");
          rowEl.className = "tree-field-row";
          fieldsDiv.appendChild(rowEl);
        }
        const fieldDiv = document.createElement("div");
        fieldDiv.className = "tree-field";
        const lblSpan = document.createElement("span");
        lblSpan.className = "tree-field-label";
        lblSpan.textContent = fieldLabel(f);
        fieldDiv.appendChild(lblSpan);
        fieldDiv.appendChild(buildFieldInput(item, f, configKey));
        rowEl.appendChild(fieldDiv);
      });
      card.appendChild(fieldsDiv);
    }

    // Actions
    const actions = document.createElement("div");
    actions.className = "tree-actions";
    if (!isString && treeSchema.childrenKey) {
      const addCh = document.createElement("button");
      addCh.className = "tree-btn add";
      addCh.textContent = "+ 子项";
      addCh.onclick = function () {
        if (!Array.isArray(item[treeSchema.childrenKey]))
          item[treeSchema.childrenKey] = [];
        item[treeSchema.childrenKey].push(
          createTreeNode(treeSchema.nodeFields, treeSchema.childrenKey),
        );
        markTreeDirty(configKey);
        const topContainer = node.closest(".tree-editor");
        if (topContainer)
          renderTreeEditor(
            configKey,
            arrayData,
            treeSchema,
            topContainer,
          );
      };
      actions.appendChild(addCh);
    }
    const delBtn = document.createElement("button");
    delBtn.className = "tree-btn del";
    delBtn.textContent = "删除";
    delBtn.onclick = function () {
      arrayData.splice(idx, 1);
      markTreeDirty(configKey);
      const topContainer = node.closest(".tree-editor");
      if (topContainer)
        renderTreeEditor(configKey, arrayData, treeSchema, topContainer);
    };
    actions.appendChild(delBtn);
    card.appendChild(actions);
    node.appendChild(card);

    // Children
    if (!isString && treeSchema.childrenKey) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "tree-node-children";
      if (
        Array.isArray(item[treeSchema.childrenKey]) &&
        item[treeSchema.childrenKey].length > 0
      ) {
        renderTreeNodes(
          configKey,
          item[treeSchema.childrenKey],
          treeSchema,
          childrenContainer,
        );
      }
      childrenContainer.appendChild(
        buildAddRow(
          configKey,
          treeSchema,
          arrayData,
          node.closest(".tree-editor"),
          item,
        ),
      );
      node.appendChild(childrenContainer);
    }

    // Gallery: append per-album image section for galleryConfig
    if (configKey === "galleryConfig" && !isString && item.id) {
      const gallerySection = document.createElement("div");
      gallerySection.className = "gallery-album-images";
      gallerySection.setAttribute("data-album-id", item.id);
      node.appendChild(gallerySection);
      loadGalleryImages(item.id, gallerySection);
    }

    container.appendChild(node);
  });
}

export function markTreeDirty(configKey) {
  STATE.modifiedConfigs.add(configKey);
  updateStatusDot();
  syncJsonEditor(configKey);
}
