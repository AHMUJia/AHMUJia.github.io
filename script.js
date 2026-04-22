(() => {
  const storageKey = "mjl_theme";

  function prefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function getInitialTheme() {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
    return prefersDark() ? "dark" : "light";
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(storageKey, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || getInitialTheme();
    setTheme(current === "dark" ? "light" : "dark");
  }

  // Theme init
  setTheme(getInitialTheme());
  const toggleBtn = document.querySelector("[data-theme-toggle]");
  if (toggleBtn) toggleBtn.addEventListener("click", toggleTheme);

  // Footer year
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Posts preview (home) or posts list (blog page)
  async function loadPosts() {
    if (Array.isArray(window.__POSTS__)) return window.__POSTS__;
    // Fallback for future hosted mode (http/https).
    try {
      const res = await fetch("./posts.json", { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function renderPostCard(post) {
    const tags = (post.tags || []).slice(0, 4);
    const tagHtml = tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");

    return `
      <article class="post-card">
        <header>
          <h3 class="post-title">${escapeHtml(post.title)}</h3>
          <div class="post-meta">
            <span>${escapeHtml(post.date)}</span>
            <span aria-hidden="true">·</span>
            <span>${escapeHtml(post.readingTime || "3 min")}</span>
          </div>
        </header>
        <div class="post-tags" aria-label="标签">${tagHtml}</div>
        <p class="post-summary">${escapeHtml(post.summary || "")}</p>
        <a class="card-link" href="${encodeURI(post.url)}">阅读全文 →</a>
      </article>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  (async () => {
    const preview = document.querySelector("[data-posts-preview]");
    const list = document.querySelector("[data-posts-list]");
    if (!preview && !list) return;

    const posts = await loadPosts();
    if (!posts || !Array.isArray(posts)) {
      const target = preview || list;
      target.innerHTML = `<div class="panel muted">未找到文章索引。请确认根目录存在 <code>posts-data.js</code>（直接打开页面使用）或 <code>posts.json</code>（http/https 模式可用）。</div>`;
      return;
    }

    const sorted = [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const shown = preview ? sorted.slice(0, 3) : sorted;
    const html = shown.map(renderPostCard).join("");
    (preview || list).innerHTML = html || `<div class="panel muted">暂无文章</div>`;
  })();
})();
(() => {
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
(() => {
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

