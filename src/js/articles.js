// ============================================================
// 文章管理
// ============================================================

/** 跟踪文章编辑器是否有未保存的更改 */
let articleDirty = false;

async function loadArticles() {
  if (!STATE.projectDir) return;
  try {
    STATE.articles = [];
    const postsDir = "src/content/posts";
    const entries = await listDir(postsDir);
    const mdEntries = entries.filter(function(e) {
      return !e.name.startsWith(".") &&
        ((e.kind === "file" && e.name.endsWith(".md")) || e.kind === "directory");
    });

    // 并行加载所有文章文件
    const results = await Promise.allSettled(
      mdEntries.map(function(entry) {
        const filePath = entry.kind === "directory"
          ? `${postsDir}/${entry.name}/index.md`
          : `${postsDir}/${entry.name}`;
        return readTextFile(filePath).then(function(content) {
          const article = parseArticleFrontMatter(content);
          article.path = filePath;
          article.fileName = entry.kind === "directory" ? entry.name + "/index.md" : entry.name;
          return article;
        });
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        STATE.articles.push(r.value);
      }
    }

    STATE.articleFiltered = [...STATE.articles];
    document.getElementById("articleCount").textContent =
      STATE.articles.length;
    renderArticleTable();
  } catch (e) {
    console.warn("Load articles failed:", e.message);
    document.getElementById("articleTableBody").innerHTML =
      '<tr><td colspan="6"><div class="empty-state"><div class="icon">-</div><h3>无法加载文章</h3><p>请确保已选择正确的项目目录</p></div></td></tr>';
  }
}

function parseArticleFrontMatter(content) {
  const article = {
    title: "",
    published: "",
    tags: [],
    category: "",
    draft: false,
    pinned: false,
    encrypted: false,
  };
  if (!content.startsWith("---")) return article;
  const end = content.indexOf("---", 3);
  if (end === -1) return article;
  const fm = content.substring(3, end).trim();
  const lines = fm.split("\n");

  // 多行值支持：如果某行以空白字符开头，则追加到前一个值
  let currentKey = null, currentValue = "";
  function flushKV() {
    if (!currentKey) return;
    const v = currentValue.trim();
    applyKV(currentKey, v);
    currentKey = null;
    currentValue = "";
  }

  for (const line of lines) {
    // 多行值的缩进续行（YAML 块标量风格）
    if (currentKey && (line.startsWith("  ") || line.startsWith("\t"))) {
      currentValue += "\n" + line.trimStart();
      continue;
    }
    // 检查这是否是一个新的 key:value 对
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (m) {
      flushKV();
      currentKey = m[1];
      currentValue = m[2];
    } else if (currentKey && line.trim()) {
      // 裸续行
      currentValue += " " + line.trim();
    }
  }
  flushKV();

  function applyKV(key, value) {
    const v = value.replace(/^["']|["']$/g, "").trim();
    if (key === "title") article.title = v;
    else if (key === "published") article.published = v;
    else if (key === "updated") article.updated = v;
    else if (key === "description") article.description = v;
    else if (key === "image") article.image = v;
    else if (key === "category") article.category = v;
    else if (key === "tags")
      article.tags = v
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((t) => t.trim().replace(/["']/g, ""))
        .filter(Boolean);
    else if (key === "draft") article.draft = v.toLowerCase() === "true";
    else if (key === "pinned") article.pinned = v.toLowerCase() === "true";
    else if (key === "priority") article.priority = parseInt(v);
    else if (key === "encrypted") article.encrypted = v.toLowerCase() === "true";
    else if (key === "password") article.password = v;
    else if (key === "comment") article.comment = v.toLowerCase() !== "false";
    else if (key === "licenseName") article.licenseName = v;
    else if (key === "author") article.author = v;
    else if (key === "sourceLink") article.sourceLink = v;
    else if (key === "alias") article.alias = v;
    else if (key === "lang") article.lang = v;
  }

  return article;
}

function renderArticleTable() {
  const tbody = document.getElementById("articleTableBody");
  if (STATE.articleFiltered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="empty-state"><div class="icon">-</div><h3>暂无文章</h3><p>点击"+ 新建文章"创建第一篇</p></div></td></tr>';
    return;
  }

  // 使用 DocumentFragment 以提升大文章列表的性能
  const frag = document.createDocumentFragment();
  STATE.articleFiltered.forEach(function(a) {
    const statusBadges = [];
    if (a.draft)
      statusBadges.push(
        '<span style="background:var(--warning);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">草稿</span>'
      );
    if (a.pinned)
      statusBadges.push(
        '<span style="background:var(--accent);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">置顶</span>'
      );
    if (a.encrypted)
      statusBadges.push(
        '<span style="background:var(--danger);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">加密</span>'
      );
    if (!statusBadges.length)
      statusBadges.push(
        '<span style="color:var(--success);font-size:11px">已发布</span>'
      );
    const tagsHtml = (a.tags || [])
      .slice(0, 3)
      .map((t) => `<span class="tag-badge">${escapeHtml(t)}</span>`)
      .join("");

    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class="title-cell" onclick="openArticleEditor('${escapeAttr(a.path)}')">${escapeHtml(a.title || "(无标题)")}</td>` +
      `<td>${escapeHtml(a.category || "-")}</td>` +
      `<td>${tagsHtml || "-"}</td>` +
      `<td style="font-size:12px;color:var(--text3)">${a.published || "-"}</td>` +
      `<td>${statusBadges.join(" ")}</td>` +
      `<td class="actions">` +
      `<button class="btn btn-secondary btn-sm" onclick="openArticleEditor('${escapeAttr(a.path)}')">编辑</button>` +
      `<button class="btn btn-danger btn-sm" onclick="deleteArticle('${escapeAttr(a.path)}','${escapeAttr(a.title)}')">删除</button>` +
      `</td>`;
    frag.appendChild(tr);
  });

  tbody.innerHTML = "";
  tbody.appendChild(frag);
}

function escapeAttr(s) {
  return s.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

const _filterArticles = debounce(function() {
  const search = (
    document.getElementById("articleSearch").value || ""
  ).toLowerCase();
  const filter = document.getElementById("articleFilter").value;
  STATE.articleFiltered = STATE.articles.filter((a) => {
    if (filter === "published" && a.draft) return false;
    if (filter === "draft" && !a.draft) return false;
    if (filter === "pinned" && !a.pinned) return false;
    if (filter === "encrypted" && !a.encrypted) return false;
    if (search) {
      return (
        (a.title || "").toLowerCase().includes(search) ||
        (a.category || "").toLowerCase().includes(search) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(search))
      );
    }
    return true;
  });
  renderArticleTable();
}, 300);

function filterArticles() {
  _filterArticles();
}

function openNewArticle() {
  if (articleDirty) {
    if (!confirm("当前文章有未保存的修改，确定放弃并新建吗？")) return;
  }
  articleDirty = false;
  STATE.currentArticlePath = null;
  document.getElementById("articleEditorTitle").textContent = "新建文章";
  document.getElementById("articleFilePath").textContent = "";
  // 重置表单
  [
    "title",
    "published",
    "updated",
    "description",
    "image",
    "category",
    "tags",
    "license",
    "author",
    "source",
    "alias",
    "password",
  ].forEach((id) => {
    document.getElementById("af-" + id).value = "";
  });
  document.getElementById("af-published").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("af-lang").value = "";
  ["draft", "pinned", "comment", "encrypted"].forEach((id) => {
    document.getElementById("af-" + id).checked = false;
  });
  document.getElementById("af-comment").checked = true;
  document.getElementById("af-priority").value = "0";
  document.getElementById("af-password-row").classList.add("hidden");
  document.getElementById("articleContent").value = "";
  updateArticlePreview();
  toggleArticleEditor(true);
}

async function openArticleEditor(relativePath) {
  if (articleDirty) {
    if (!confirm("当前文章有未保存的修改，确定放弃并打开其他文章吗？")) return;
  }
  if (!STATE.projectDir) {
    showToast("请先选择项目目录", "error");
    return;
  }
  try {
    const content = await readTextFile(relativePath);
    STATE.currentArticlePath = relativePath;
    articleDirty = false;
    document.getElementById("articleEditorTitle").textContent =
      "编辑文章";
    document.getElementById("articleFilePath").textContent = relativePath;

    // 解析 front matter
    const article = parseArticleFrontMatter(content);
    document.getElementById("af-title").value = article.title || "";
    document.getElementById("af-published").value =
      article.published || "";
    document.getElementById("af-updated").value = article.updated || "";
    document.getElementById("af-description").value =
      article.description || "";
    document.getElementById("af-image").value = article.image || "";
    document.getElementById("af-category").value = article.category || "";
    document.getElementById("af-tags").value = (article.tags || []).join(
      ", ",
    );
    document.getElementById("af-license").value =
      article.licenseName || "";
    document.getElementById("af-author").value = article.author || "";
    document.getElementById("af-source").value = article.sourceLink || "";
    document.getElementById("af-alias").value = article.alias || "";
    document.getElementById("af-lang").value = article.lang || "";
    document.getElementById("af-draft").checked = article.draft || false;
    document.getElementById("af-pinned").checked =
      article.pinned || false;
    document.getElementById("af-comment").checked =
      article.comment !== false;
    document.getElementById("af-encrypted").checked =
      article.encrypted || false;
    document.getElementById("af-priority").value = article.priority || 0;
    if (article.encrypted) {
      document
        .getElementById("af-password-row")
        .classList.remove("hidden");
      document.getElementById("af-password").value =
        article.password || "";
    } else {
      document.getElementById("af-password-row").classList.add("hidden");
    }

    // 获取正文内容（front matter 之后）
    let body = content;
    if (body.startsWith("---")) {
      const end = body.indexOf("---", 3);
      if (end !== -1) body = body.substring(end + 3);
    }
    document.getElementById("articleContent").value = body.trimStart();
    updateArticlePreview();
    toggleArticleEditor(true);
  } catch (e) {
    showToast("打开文章失败: " + e.message, "error");
  }
}

function toggleArticleEditor(show) {
  document.getElementById("articleEditorInline").style.display = show
    ? "flex"
    : "none";
  document.getElementById("articleListSection").style.display = show
    ? "none"
    : "block";
  if (!show) {
    STATE.currentArticlePath = null;
    articleDirty = false;
  }
}

function closeArticleEditor() {
  if (articleDirty) {
    if (!confirm("当前文章有未保存的修改，确定关闭吗？")) return;
  }
  toggleArticleEditor(false);
}

function updateArticlePreview() {
  const content = document.getElementById("articleContent").value;
  const preview = document.getElementById("articlePreview");
  try {
    if (typeof marked !== "undefined") {
      preview.innerHTML = marked.parse(content || "");
    } else {
      preview.innerHTML =
        '<p style="color:var(--text3)">预览加载中...</p>';
    }
  } catch (e) {
    preview.innerHTML = '<p style="color:var(--danger)">预览错误</p>';
  }
}

// 任何 front matter 或内容更改时将文章标记为脏
function markArticleDirty() {
  articleDirty = true;
}

async function saveArticle(silent) {
  if (!STATE.projectDir) {
    if (!silent) showToast("请先选择项目目录", "error");
    return;
  }
  // 构建 front matter
  const fm = buildFrontMatter();
  const bodyContent = document.getElementById("articleContent").value;
  const fullContent = fm + "\n" + bodyContent;

  // 确定文件路径
  let filePath = STATE.currentArticlePath;
  if (!filePath) {
    const title = document.getElementById("af-title").value || "new-post";
    const slug =
      title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, "-")
        .replace(/^-|-$/g, "") || "new-post";
    filePath = `src/content/posts/${slug}.md`;
  }

  try {
    await writeTextFile(filePath, fullContent);
    articleDirty = false;
    if (!silent) {
      showToast("文章已保存: " + filePath, "success");
      closeArticleEditor();
      loadArticles();
    } else {
      // 静默保存：如果是新文章则更新当前路径
      if (!STATE.currentArticlePath) STATE.currentArticlePath = filePath;
    }
  } catch (e) {
    if (!silent) showToast("保存文章失败: " + e.message, "error");
    throw e;
  }
}

function buildFrontMatter() {
  const g = (id) => document.getElementById("af-" + id).value.trim();
  const gc = (id) => document.getElementById("af-" + id).checked;
  let fm = "---\n";
  if (g("title")) fm += `title: "${g("title")}"\n`;
  if (g("published")) fm += `published: ${g("published")}\n`;
  if (g("updated")) fm += `updated: ${g("updated")}\n`;
  if (g("description")) fm += `description: "${g("description")}"\n`;
  if (g("image")) fm += `image: "${g("image")}"\n`;
  if (g("tags")) {
    const tags = g("tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length)
      fm += `tags: [${tags.map((t) => `"${t}"`).join(", ")}]\n`;
  }
  if (g("category")) fm += `category: ${g("category")}\n`;
  if (g("license")) fm += `licenseName: "${g("license")}"\n`;
  if (g("author")) fm += `author: "${g("author")}"\n`;
  if (g("source")) fm += `sourceLink: "${g("source")}"\n`;
  if (g("alias")) fm += `alias: "${g("alias")}"\n`;
  if (g("lang")) fm += `lang: ${g("lang")}\n`;
  fm += `draft: ${gc("draft")}\n`;
  fm += `pinned: ${gc("pinned")}\n`;
  if (gc("pinned") && g("priority")) fm += `priority: ${g("priority")}\n`;
  fm += `comment: ${gc("comment")}\n`;
  if (gc("encrypted")) {
    fm += `encrypted: true\n`;
    if (g("password")) fm += `password: "${g("password")}"\n`;
  }
  fm += "---";
  return fm;
}

async function deleteArticle(relativePath, title) {
  if (
    !confirm(
      `确定删除文章"${title}"?\n路径: ${relativePath}\n此操作不可撤销。`,
    )
  )
    return;
  if (!STATE.projectDir) {
    showToast("请先选择项目目录", "error");
    return;
  }
  try {
    const parts = relativePath.replace(/\\/g, "/").split("/");
    const fileName = parts.pop();
    const dirPath = parts.filter(Boolean);
    let handle = STATE.projectDir;
    for (const part of dirPath) {
      handle = await handle.getDirectoryHandle(part, { create: false });
    }
    await handle.removeEntry(fileName);
    showToast("文章已删除", "success");
    loadArticles();
  } catch (e) {
    showToast("删除失败: " + e.message, "error");
  }
}

// 编辑器内容预览 + 自动保存
let articleAutoSaveTimer = null;
let articleAutoSaveStatus = null;

// 监听内容更改以触发预览更新和自动保存
document.getElementById("articleContent").addEventListener("input", function() {
  debounce(updateArticlePreview, 300)();
  markArticleDirty();
  // 5 秒无操作后自动保存
  if (STATE.currentArticlePath || document.getElementById("af-title").value.trim()) {
    if (articleAutoSaveTimer) clearTimeout(articleAutoSaveTimer);
    articleAutoSaveTimer = setTimeout(function() {
      if (!articleAutoSaveStatus) {
        articleAutoSaveStatus = document.createElement("span");
        articleAutoSaveStatus.className = "auto-save-status";
        const titleEl = document.getElementById("articleEditorTitle");
        if (titleEl) titleEl.appendChild(articleAutoSaveStatus);
      }
      articleAutoSaveStatus.textContent = "保存中...";
      articleAutoSaveStatus.className = "auto-save-status saving";
      saveArticle(true).then(function() {
        articleAutoSaveStatus.textContent = "已自动保存";
        articleAutoSaveStatus.className = "auto-save-status saved";
        setTimeout(function() {
          if (articleAutoSaveStatus) articleAutoSaveStatus.textContent = "";
        }, 3000);
      }).catch(function() {
        articleAutoSaveStatus.textContent = "自动保存失败";
        articleAutoSaveStatus.className = "auto-save-status";
      });
    }, 5000);
  }
});

// Front matter 字段更改时标记为脏
["af-title", "af-published", "af-updated", "af-description", "af-image",
 "af-category", "af-tags", "af-license", "af-author", "af-source",
 "af-alias", "af-lang", "af-password", "af-priority"].forEach(function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", markArticleDirty);
    el.addEventListener("change", markArticleDirty);
  }
});
["af-draft", "af-pinned", "af-comment", "af-encrypted"].forEach(function(id) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", markArticleDirty);
});
