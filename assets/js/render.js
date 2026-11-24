(function () {
  function isEn() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('en');
  }

  const ROLE_LABEL_ZH = {
    'first': '第一作者',
    'co-first': '共同第一作者',
    'corresponding': '通讯作者',
    'co-corresponding': '共同通讯作者'
  };
  const ROLE_LABEL_EN = {
    'first': 'First Author',
    'co-first': 'Co-First Author',
    'corresponding': 'Corresponding Author',
    'co-corresponding': 'Co-Corresponding Author'
  };
  function roleLabel(role) {
    return (isEn() ? ROLE_LABEL_EN : ROLE_LABEL_ZH)[role];
  }
  // Backwards compat: keep ROLE_LABEL (used elsewhere) resolved lazily for pub rendering.
  const ROLE_LABEL = new Proxy({}, { get: (_, k) => roleLabel(k) });

  function L(zh, en) {
    return isEn() ? en : zh;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
  }

  // Bold "Meng Jialin" / "Jialin Meng" everywhere in authors string.
  function formatAuthors(authors) {
    return escapeHtml(authors || '')
      .replace(/\bMeng Jialin\b/g, '<strong>Meng Jialin</strong>')
      .replace(/\bJialin Meng\b/g, '<strong>Jialin Meng</strong>');
  }

  function pubLink(p) {
    if (p.link) return p.link;
    if (p.doi) return 'https://doi.org/' + p.doi;
    return '';
  }

  function periodicalText(p) {
    const journal = escapeHtml(p.journal || '');
    const year = escapeHtml(p.year);
    const volume = escapeHtml(p.volume || '');
    let s = '<em><strong>' + journal + '</strong></em>, ' + year;
    if (volume) s += ', ' + volume;
    s += '.';
    return s;
  }

  function renderHeader(p) {
    const parts = ['<span class="year-tag">' + escapeHtml(p.year) + '</span>'];
    if (p.type) {
      parts.push('<span class="type-tag type-' + escapeHtml(String(p.type).toLowerCase()) + '">' + escapeHtml(p.type) + '</span>');
    }
    const rLbl = roleLabel(p.role);
    if (p.role && rLbl) {
      parts.push('<span class="role-tag role-' + escapeHtml(p.role) + '">' + rLbl + '</span>');
    }
    if (p.if != null && p.if !== '') { var _ifv = parseFloat(p.if); var _ift = isNaN(_ifv) ? '' : (_ifv >= 10 ? ' if-high' : (_ifv >= 5 ? ' if-mid' : ' if-low')); parts.push('<span class="meta-if' + _ift + '">IF ' + escapeHtml(p.if) + '</span>'); }
    if (p.casZone) { var _zc = (String(p.casZone) === '1') ? ' cas-top' : ''; parts.push('<span class="meta-zone' + _zc + '">' + L('中科院 ' + escapeHtml(p.casZone) + ' 区', 'CAS Tier ' + escapeHtml(p.casZone)) + '</span>'); }
    if (p.jcrZone) parts.push('<span class="meta-zone">' + L('JCR ' + escapeHtml(p.jcrZone) + ' 区', 'JCR Q' + escapeHtml(p.jcrZone)) + '</span>');
    if (p.isTop) parts.push('<span class="meta-top">' + L('Top 期刊', 'Top Journal') + '</span>');
    return '<div class="pub-header">' + parts.join('') + '</div>';
  }

  function inlinePaperLink(p) {
    const url = pubLink(p);
    if (!url) return '';
    return ' <a class="paper-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Paper →</a>';
  }

  // ---- 同年度内的排序权重 = IF × 署名系数 ----
  // 署名系数：本人是「一作里的第一个」或「通讯里的最后一个」→ 1.0，其余代表性署名 → 0.6。
  // （通讯按 CV 惯例从后往前数，作者列表末位通讯 = 第一通讯，所以看的是 * 里的最后一个。）
  const SELF_RE = /\b(Jialin Meng|Meng Jialin)\b/;

  // "A#, B#, C, D*, E*" → [{name, co, corr}]
  function parseAuthors(s) {
    return String(s || '').split(/,\s*/).filter(Boolean).map(function (raw) {
      const t = raw.trim();
      return { name: t.replace(/[#*\s]+$/, ''), co: t.indexOf('#') >= 0, corr: t.indexOf('*') >= 0 };
    });
  }

  function roleCoef(p) {
    const list = parseAuthors(p.authors);
    let me = -1;
    for (let i = 0; i < list.length; i++) { if (SELF_RE.test(list[i].name)) { me = i; break; } }
    if (me >= 0) {
      const co = [], corr = [];
      for (let i = 0; i < list.length; i++) {
        if (list[i].co) co.push(i);
        if (list[i].corr) corr.push(i);
      }
      if (me === 0) return 1;                                     // 第一作者
      if (co.length && co[0] === me) return 1;                    // 共同一作里的第一个
      if (corr.length && corr[corr.length - 1] === me) return 1;  // 通讯里的最后一个
      if (co.length || corr.length) return 0.6;
    }
    // 作者串缺失/没有 #* 标记时退回 role 字段
    return (p.role === 'first' || p.role === 'corresponding') ? 1 : 0.6;
  }

  function pubScore(p) {
    const v = parseFloat(p.if);
    return (isNaN(v) ? 0 : v) * roleCoef(p);
  }

  function comparePubs(a, b) {
    const dy = Number(b.year) - Number(a.year);
    if (dy) return dy;
    return pubScore(b) - pubScore(a);
  }

  function renderPubs(selector, opts) {
    opts = opts || {};
    const el = document.querySelector(selector);
    if (!el || !Array.isArray(window.__PUBS__)) return;

    const sorted = window.__PUBS__.slice().sort(comparePubs);
    const items = opts.limit ? sorted.slice(0, opts.limit) : sorted;

    el.innerHTML = items.map(function (p) {
      const hasImg = !!p.image;
      const imgBlock = hasImg
        ? '<div class="pub-image"><img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.title || '') + '" loading="lazy"></div>'
        : '';
      return [
        '<li><div class="pub-row' + (hasImg ? ' has-image' : '') + '">',
          '<div class="pub-content">',
            renderHeader(p),
            '<div class="title">' + escapeHtml(p.title) + '</div>',
            '<div class="author">' + formatAuthors(p.authors) + '</div>',
            '<div class="periodical">' + periodicalText(p) + inlinePaperLink(p) + '</div>',
          '</div>',
          imgBlock,
        '</div></li>'
      ].join('');
    }).join('');

    if (opts.moreLink) {
      const more = document.createElement('div');
      more.className = 'pub-more';
      more.innerHTML = '<a href="' + escapeHtml(opts.moreLink) + '">See full publication list →</a>';
      if (el.parentElement) el.parentElement.appendChild(more);
    }
  }

  function renderAbout(selector) {
    const el = document.querySelector(selector);
    if (!el || !Array.isArray(window.__ABOUT__)) return;
    el.innerHTML = window.__ABOUT__.map(function (p) {
      return '<p>' + p + '</p>';
    }).join('');
  }

  function renderEducation(selector) {
    const el = document.querySelector(selector);
    if (!el || !Array.isArray(window.__EDUCATION__)) return;
    el.innerHTML = window.__EDUCATION__.map(function (e) {
      const logoCls = 'institution-logo' + (e.logoStyle ? ' ' + escapeHtml(e.logoStyle) : '');
      const levels = (e.levels || []).map(function (lv) {
        return '<li>' +
          '<span class="degree">' + escapeHtml(lv.degree) + '</span>' +
          '<span>' + escapeHtml(lv.field) + '</span>' +
          '<span class="period">' + escapeHtml(lv.period) + '</span>' +
        '</li>';
      }).join('');
      return '<div class="edu-card">' +
        '<img src="' + escapeHtml(e.logo || '') + '" alt="' + escapeHtml(e.institution) + '" class="' + logoCls + '">' +
        '<div>' +
          '<h3>' + escapeHtml(e.institution) + '</h3>' +
          '<ul class="edu-levels">' + levels + '</ul>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderExperience(selector) {
    const el = document.querySelector(selector);
    if (!el || !Array.isArray(window.__EXPERIENCE__)) return;
    el.innerHTML = window.__EXPERIENCE__.map(function (g) {
      const logoCls = 'exp-logo' + (g.logoStyle ? ' ' + escapeHtml(g.logoStyle) : '');
      const roles = (g.roles || []).map(function (r) {
        return '<li>' +
          '<span class="role-detail">' + escapeHtml(r.detail) + '</span>' +
          '<span class="role-period">' + escapeHtml(r.period) + '</span>' +
        '</li>';
      }).join('');
      return '<div class="exp-group">' +
        '<img src="' + escapeHtml(g.logo || '') + '" alt="' + escapeHtml(g.alt || '') + '" class="' + logoCls + '">' +
        '<ul class="role-list">' + roles + '</ul>' +
      '</div>';
    }).join('');
  }

  function renderProjects(selector) {
    const el = document.querySelector(selector);
    if (!el || !Array.isArray(window.__PROJECTS__)) return;
    const en = isEn();
    const open = en ? ' (' : '（';
    const close = en ? ')' : '）';
    const sep = en ? ', ' : '，';
    const colon = en ? ': ' : '：';
    const endP = en ? '.' : '。';
    el.innerHTML = window.__PROJECTS__.map(function (p) {
      const meta = [];
      if (p.period) meta.push(escapeHtml(p.period));
      if (p.status) meta.push(escapeHtml(p.status));
      const metaStr = meta.length ? open + meta.join(sep) + close : '';
      return '<div class="project-card">' +
        '<strong>' + escapeHtml(p.title) + '</strong>' + colon +
        escapeHtml(p.description) + metaStr + endP +
      '</div>';
    }).join('');
  }

  function renderAwards(selector, opts) {
    opts = opts || {};
    const el = document.querySelector(selector);
    if (!el || !Array.isArray(window.__AWARDS__)) return;
    const items = opts.limit ? window.__AWARDS__.slice(0, opts.limit) : window.__AWARDS__;
    const colon = isEn() ? ' — ' : '：';
    el.innerHTML = items.map(function (a) {
      return '<div class="award-item">' +
        '<span class="award-icon">🏅</span>' +
        '<div class="award-text"><strong>' + escapeHtml(a.year) + '</strong>' + colon + escapeHtml(a.text) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderResearch(selector) {
    const root = document.querySelector(selector);
    if (!root || !Array.isArray(window.__RESEARCH__)) return;
    const topics = window.__RESEARCH__;
    if (!topics.length) {
      root.innerHTML = '<p class="muted" style="text-align:center;padding:40px 0;">暂无研究方向，可在 admin 新增。</p>';
      return;
    }
    root.innerHTML = topics.map(function (t) {
      const list = (t.points || []).map(function (p) {
        return '<li>' + p + '</li>';
      }).join('');
      const hasImg = !!t.image;
      const imgHtml = hasImg
        ? '<div class="research-image"><img src="' + escapeHtml(t.image) + '" alt="' + escapeHtml(t.name || '') + '"></div>'
        : '';
      return '<div class="research-content' + (hasImg ? ' has-image' : '') + '">' +
        '<div class="research-body">' +
          '<h2 class="topic-title">' + escapeHtml(t.title || t.name) + '</h2>' +
          (list ? '<ul class="topic-points">' + list + '</ul>' : '<p class="muted">（暂无要点）</p>') +
        '</div>' +
        imgHtml +
      '</div>';
    }).join('');
  }

  function renderTools(selector) {
    const root = document.querySelector(selector);
    if (!root || !Array.isArray(window.__TOOLS__)) return;
    const tools = window.__TOOLS__;
    if (!tools.length) {
      root.innerHTML = '<p class="muted" style="text-align:center;padding:40px 0;">暂无工具，点 admin 页新增。</p>';
      return;
    }
    root.innerHTML = tools.map(function (t) {
      const imgHtml = t.image
        ? '<img class="tool-image" src="' + escapeHtml(t.image) + '" alt="' + escapeHtml(t.name) + '">'
        : '<div class="tool-image tool-image-placeholder">🧰</div>';
      const typeHtml = t.type ? '<span class="tool-type">' + escapeHtml(t.type) + '</span>' : '';
      const linkHtml = t.link
        ? '<a class="tool-link" href="' + escapeHtml(t.link) + '" target="_blank" rel="noopener">' + escapeHtml(t.link) + ' →</a>'
        : '';
      const descHtml = t.description || '<span class="muted">（无介绍）</span>';
      return '<div class="tools-content">' +
        '<div class="tool-image-wrap">' + imgHtml + '</div>' +
        '<div class="tool-body">' +
          '<h2 class="tool-name">' + escapeHtml(t.name) + '</h2>' +
          typeHtml +
          '<div class="tool-desc">' + descHtml + '</div>' +
          linkHtml +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.renderPubs = renderPubs;
  // 暴露排序内部件，供 tools/test-pub-order.js 与浏览器控制台核对
  window.__pubOrder = { parseAuthors: parseAuthors, roleCoef: roleCoef, score: pubScore, compare: comparePubs };
  window.renderAbout = renderAbout;
  window.renderEducation = renderEducation;
  window.renderExperience = renderExperience;
  window.renderProjects = renderProjects;
  window.renderAwards = renderAwards;
  window.renderTools = renderTools;
  window.renderResearch = renderResearch;
})();
