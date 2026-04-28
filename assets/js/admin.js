/**
 * UroExplorer admin frontend.
 *
 * Talks to the Node backend at /api/* (see server/server.js). Cookie-based auth.
 *
 * Structure:
 *   - boot()              entrypoint, decides login vs dashboard
 *   - showLogin()         renders login form
 *   - showDashboard()     header + tabs + main panel
 *   - selectTab(key)      delegates to per-tab renderers
 *
 * Permission model (also enforced server-side):
 *   - admin sees every tab; can edit any section; can manage users
 *   - member sees only "My Page"; PUT goes to /api/me/member which locks slug+role
 */
(function () {
  /* ============================================================
     DOM helpers
     ============================================================ */
  function $(sel, root)  { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class')        e.className = v;
        else if (k === 'html')    e.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else                      e.setAttribute(k, v);
      }
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return e;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]);
  }

  /* ============================================================
     API client
     ============================================================ */
  async function api(method, path, body) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      if (body instanceof FormData) {
        opts.body = body;  // multer parses
      } else {
        opts.body = JSON.stringify(body);
        opts.headers['Content-Type'] = 'application/json';
      }
    }
    const res = await fetch(path, opts);
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText || 'Request failed';
      const err = new Error(msg);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  /* ============================================================
     State
     ============================================================ */
  let me = null;            // { username, role, memberSlug }

  /* ============================================================
     Boot
     ============================================================ */
  async function boot() {
    const root = $('#admin-root');
    try {
      me = await api('GET', '/api/me');
      showDashboard();
    } catch (e) {
      if (e.status === 401) { showLogin(); return; }
      root.innerHTML = '';
      root.appendChild(el('div', {class: 'admin-fatal'},
        el('h1', null, '无法连接服务器'),
        el('p', null, e.message)
      ));
    }
  }

  function showLogin() {
    const root = $('#admin-root');
    root.innerHTML = '';
    root.appendChild(el('div', {class: 'login-shell'},
      el('form', {class: 'login-form', onsubmit: handleLogin},
        el('h1', null, 'UroExplorer Admin'),
        el('p', {class: 'login-sub'}, '登录以编辑网站内容'),
        el('label', null, '账号',
          el('input', {name: 'username', type: 'text', required: true, autocomplete: 'username'})
        ),
        el('label', null, '密码',
          el('input', {name: 'password', type: 'password', required: true, autocomplete: 'current-password'})
        ),
        el('button', {type: 'submit', class: 'btn-primary'}, '登录'),
        el('div', {class: 'login-error', id: 'login-error'})
      )
    ));
    setTimeout(() => { const u = $('input[name=username]'); if (u) u.focus(); }, 50);
  }

  async function handleLogin(ev) {
    ev.preventDefault();
    const form = ev.target;
    const errEl = $('#login-error');
    errEl.textContent = '';
    try {
      const username = form.username.value.trim();
      const password = form.password.value;
      me = await api('POST', '/api/login', { username, password });
      showDashboard();
    } catch (err) {
      errEl.textContent = err.message;
    }
  }

  async function handleLogout() {
    try { await api('POST', '/api/logout'); }
    catch {}
    me = null;
    showLogin();
  }

  async function handleChangePassword() {
    const oldPw = prompt('当前密码：');
    if (oldPw == null) return;
    const newPw = prompt('新密码（≥ 6 位）：');
    if (newPw == null) return;
    if (newPw.length < 6) { alert('新密码至少 6 位'); return; }
    try {
      await api('POST', '/api/me/password', { oldPassword: oldPw, newPassword: newPw });
      alert('密码已更新');
    } catch (e) {
      alert('修改失败：' + e.message);
    }
  }

  /* ============================================================
     Dashboard
     ============================================================ */
  function getTabs() {
    if (me.role === 'member') {
      return [{ key: 'me-page', label: '我的主页' }];
    }
    return [
      { key: 'team',         label: 'Team' },
      { key: 'users',        label: 'Users' },
      { key: 'about',        label: 'About' },
      { key: 'education',    label: 'Education' },
      { key: 'experience',   label: 'Experience' },
      { key: 'projects',     label: 'Projects' },
      { key: 'awards',       label: 'Awards' },
      { key: 'research',     label: 'Research' },
      { key: 'tools',        label: 'Tools' },
      { key: 'publications', label: 'Publications' }
    ];
  }

  function showDashboard() {
    const root = $('#admin-root');
    root.innerHTML = '';
    const roleLabel = me.role === 'admin' ? '管理员' : `成员 · ${me.memberSlug || '?'}`;
    root.appendChild(el('div', {class: 'admin-shell'},
      el('header', {class: 'admin-header'},
        el('div', {class: 'admin-header-left'},
          el('h1', {class: 'admin-brand'}, 'UroExplorer Admin'),
          el('span', {class: 'admin-role-badge'}, `${me.username} · ${roleLabel}`)
        ),
        el('div', {class: 'admin-header-right'},
          el('a', {href: './index.html', class: 'btn-link'}, '← 返回主页'),
          el('button', {class: 'btn-link', onclick: handleChangePassword}, '改密码'),
          el('button', {class: 'btn-link', onclick: handleLogout}, '退出')
        )
      ),
      el('div', {class: 'admin-body-content'},
        el('nav', {class: 'admin-tabs', id: 'admin-tabs'},
          ...getTabs().map(t =>
            el('button', {class: 'admin-tab', 'data-tab': t.key, onclick: () => selectTab(t.key)}, t.label)
          )
        ),
        el('main', {class: 'admin-main', id: 'admin-main'})
      )
    ));
    const tabs = getTabs();
    const initial = location.hash.replace(/^#/, '') || tabs[0].key;
    selectTab(tabs.some(t => t.key === initial) ? initial : tabs[0].key);
  }

  async function selectTab(key) {
    location.hash = key;
    $$('.admin-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === key));
    const main = $('#admin-main');
    main.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> 加载中…</div>';
    try {
      if (key === 'me-page') await renderMePage(main);
      else if (key === 'team')  await renderTeamTab(main);
      else if (key === 'users') await renderUsersTab(main);
      else                       await renderSectionTab(main, key);
    } catch (e) {
      main.innerHTML = '';
      main.appendChild(el('div', {class: 'err-flash'}, '加载失败：' + e.message));
    }
  }

  /* ============================================================
     Section: Team (admin)
     ============================================================ */
  const ROLE_TITLES = {
    copi:   'Co-PI',
    phd:    '博士研究生 · PhD Candidates',
    master: '硕士研究生 · Master Students',
    ug:     '本科生 · Undergraduates'
  };

  async function renderTeamTab(main) {
    const [team, meta] = await Promise.all([
      api('GET', '/api/data/team'),
      api('GET', '/api/data/teamMeta').catch(() => ({}))
    ]);
    main.innerHTML = '';
    main.appendChild(el('h2', null, 'Team'));

    /* Team page heading + lead (editable) */
    main.appendChild(renderTeamMetaEditor(meta));

    /* Members section */
    main.appendChild(el('h3', {style: 'margin: 28px 0 10px; color: var(--luka-accent);'}, '成员列表'));
    main.appendChild(el('div', {class: 'panel-toolbar'},
      el('button', {class: 'btn-primary', onclick: () => openMemberForm(main, null, team)}, '+ 添加成员'),
      el('span', {class: 'muted'}, `共 ${team.length} 位成员`)
    ));

    for (const role of ['copi', 'phd', 'master', 'ug']) {
      const members = team.filter(m => m.role === role);
      const section = el('section', {class: 'team-section'},
        el('h3', null, ROLE_TITLES[role]),
        el('div', {class: 'team-cards'},
          ...members.map(m => renderTeamMiniCard(m, main, team)),
          members.length === 0 ? el('p', {class: 'muted'}, '— 暂无 —') : null
        )
      );
      main.appendChild(section);
    }
  }

  function renderTeamMetaEditor(meta) {
    /* Normalize: meta can be {} on first deploy */
    if (!meta || typeof meta !== 'object') meta = {};
    if (!meta.title || typeof meta.title !== 'object') meta.title = { zh: '', en: '' };
    if (!meta.lead  || typeof meta.lead  !== 'object') meta.lead  = { zh: '', en: '' };

    const titleZh = el('input', {class: 'form-input', value: meta.title.zh || '',
      oninput: (e) => meta.title.zh = e.target.value, placeholder: 'UroExplorer' });
    const titleEn = el('input', {class: 'form-input', value: meta.title.en || '',
      oninput: (e) => meta.title.en = e.target.value, placeholder: 'UroExplorer' });
    const leadZh = el('textarea', {class: 'form-textarea', rows: 2,
      placeholder: '副标题 / 一句话介绍'});
    leadZh.value = meta.lead.zh || '';
    leadZh.addEventListener('input', () => meta.lead.zh = leadZh.value);
    const leadEn = el('textarea', {class: 'form-textarea', rows: 2,
      placeholder: 'Subtitle / one-liner'});
    leadEn.value = meta.lead.en || '';
    leadEn.addEventListener('input', () => meta.lead.en = leadEn.value);

    const flash = el('div');
    const wrap = el('div', {class: 'team-meta-card'},
      el('h3', {style: 'margin: 0 0 12px; color: var(--luka-accent);'}, '团队页文案'),
      el('p', {class: 'muted', style: 'margin: 0 0 14px; font-size: 13px;'},
        '编辑团队入口页（' ,
        el('a', {href: './team.html', target: '_blank'}, 'team.html'),
        '）的标题和副标题。'),
      el('div', {class: 'form-row bilingual'},
        el('label', null, '页面标题'),
        el('div', {class: 'field'},
          el('div', {class: 'lang-pair'}, el('span', {class: 'lang-tag'}, '中文'), titleZh),
          el('div', {class: 'lang-pair'}, el('span', {class: 'lang-tag'}, 'English'), titleEn)
        )
      ),
      el('div', {class: 'form-row bilingual'},
        el('label', null, '副标题 / 介绍'),
        el('div', {class: 'field'},
          el('div', {class: 'lang-pair'}, el('span', {class: 'lang-tag'}, '中文'), leadZh),
          el('div', {class: 'lang-pair'}, el('span', {class: 'lang-tag'}, 'English'), leadEn)
        )
      ),
      el('div', {style: 'display: flex; gap: 10px; align-items: center;'},
        el('button', {class: 'btn-primary', onclick: save}, '保存团队页文案'),
        flash
      )
    );

    async function save() {
      flash.className = ''; flash.textContent = '';
      try {
        await api('PUT', '/api/data/teamMeta', meta);
        flash.className = 'ok-flash'; flash.textContent = '✓ 已保存';
      } catch (e) {
        flash.className = 'err-flash'; flash.textContent = '保存失败：' + e.message;
      }
    }

    return wrap;
  }

  function renderTeamMiniCard(member, main, team) {
    const name = (typeof member.name === 'object' ? (member.name.zh || member.name.en) : member.name) || member.slug;
    const photo = member.photo
      ? el('img', {src: member.photo, alt: name})
      : el('span', null, (name || '?').slice(0, 1));
    return el('div', {class: 'team-mini-card'},
      el('div', {class: 'team-mini-photo'}, photo),
      el('div', {class: 'team-mini-body'},
        el('p', {class: 'team-mini-name'}, name),
        el('p', {class: 'team-mini-meta'}, member.slug)
      ),
      el('div', {class: 'team-mini-actions'},
        el('button', {onclick: () => openMemberForm(main, member, team)}, '编辑'),
        el('button', {class: 'btn-danger', onclick: () => deleteMember(main, member, team)}, '删除')
      )
    );
  }

  async function deleteMember(main, member, team) {
    if (!confirm(`确认删除成员 "${member.slug}"？此操作会立即生效，不可撤销。`)) return;
    const next = team.filter(m => m.slug !== member.slug);
    try {
      await api('PUT', '/api/data/team', next);
      await renderTeamTab(main);
    } catch (e) {
      alert('删除失败：' + e.message);
    }
  }

  function openMemberForm(main, member, team) {
    const isNew = !member;
    const seed = isNew
      ? { slug: '', role: 'phd', name: {zh:'',en:''}, title: {zh:'',en:''}, affil: {zh:'',en:''}, email: '',
          photo: '', about: {zh: [], en: []},
          education: [], experience: [], projects: [], publications: [], awards: [],
          social: { scholar: '', orcid: '', researchgate: '', github: '' } }
      : JSON.parse(JSON.stringify(member));

    main.innerHTML = '';
    main.appendChild(el('h2', null, isNew ? '添加成员' : `编辑：${member.slug}`));
    main.appendChild(buildMemberForm(seed, {
      isNew,
      lockSlug: !isNew,           // admin can pick slug for new, but locks for existing
      lockRole: false,            // admin can change role
      onCancel: () => renderTeamTab(main),
      onSave:   async (next) => {
        const otherMembers = isNew ? team : team.filter(m => m.slug !== member.slug);
        // slug uniqueness
        if (otherMembers.some(m => m.slug === next.slug)) {
          throw new Error(`slug "${next.slug}" 已存在`);
        }
        const arr = isNew ? [...otherMembers, next] : team.map(m => m.slug === member.slug ? next : m);
        await api('PUT', '/api/data/team', arr);
        await renderTeamTab(main);
      }
    }));
  }

  /* ============================================================
     Section: My Page (member self-edit)
     ============================================================ */
  async function renderMePage(main) {
    let member;
    try { member = await api('GET', '/api/me/member'); }
    catch (e) {
      main.innerHTML = '';
      main.appendChild(el('div', {class: 'err-flash'}, '无法加载你的成员记录：' + e.message));
      return;
    }
    main.innerHTML = '';
    main.appendChild(el('h2', null, '编辑：' + (member.slug)));
    main.appendChild(el('p', {class: 'muted'},
      '修改后保存，主页（', el('a', {href: './team-person.html?slug=' + encodeURIComponent(member.slug), target: '_blank'}, '点这里看'),
      '）会立即更新。slug 和 role 由管理员管理。'));
    main.appendChild(buildMemberForm(JSON.parse(JSON.stringify(member)), {
      isNew: false,
      lockSlug: true,
      lockRole: true,
      onCancel: () => selectTab('me-page'),
      onSave: async (next) => {
        await api('PUT', '/api/me/member', next);
      }
    }));
  }

  /* ============================================================
     Member form (used by both Team-edit and My-Page)
     ============================================================ */
  function buildMemberForm(member, opts) {
    const form = el('form', {class: 'admin-form', onsubmit: (e) => e.preventDefault()});
    const flash = el('div');

    /* slug + role */
    form.appendChild(formRow('Slug', el('input', {
      class: 'form-input', value: member.slug || '', readonly: opts.lockSlug ? 'readonly' : null,
      placeholder: 'phd-zhangsan',
      oninput: (e) => member.slug = e.target.value.trim()
    }), opts.lockSlug ? 'URL 标识，已锁定。修改请联系管理员。' : 'URL-safe：a-z, 0-9, - 。一旦设定，团队页链接基于此。'));

    const roleSelect = el('select', { class: 'form-select', disabled: opts.lockRole ? 'disabled' : null,
      onchange: (e) => member.role = e.target.value });
    for (const k of ['copi','phd','master','ug']) {
      const o = el('option', {value: k}, ROLE_TITLES[k]);
      if (member.role === k) o.setAttribute('selected', '');
      roleSelect.appendChild(o);
    }
    form.appendChild(formRow('角色 / Role', roleSelect, opts.lockRole ? '已锁定。' : '不同角色对应不同主色调。'));

    /* bilingual basics */
    form.appendChild(bilingualRow('姓名 / Name', member, 'name'));
    form.appendChild(bilingualRow('职位 / Title', member, 'title'));
    form.appendChild(bilingualRow('单位 / Affiliation', member, 'affil', { textarea: true }));

    /* email */
    form.appendChild(formRow('Email', el('input', {
      class: 'form-input', value: member.email || '', type: 'email',
      oninput: (e) => member.email = e.target.value.trim()
    })));

    /* photo */
    form.appendChild(photoRow(member));

    /* about (bilingual array of strings) */
    form.appendChild(bilingualStringsRow('简介 / About', member, 'about',
      '每行一段，会作为单独的 <p> 渲染。可写 HTML（链接、加粗等）。'));

    /* Nested arrays — visual list editors */
    form.appendChild(listRow('教育 / Education',    member, 'education',    EDU_SCHEMA));
    form.appendChild(listRow('经历 / Experience',   member, 'experience',   EXP_SCHEMA));
    form.appendChild(listRow('项目 / Projects',     member, 'projects',     PROJECT_SCHEMA));
    form.appendChild(listRow('论文 / Publications', member, 'publications', PUB_SCHEMA));
    form.appendChild(listRow('奖项 / Awards',       member, 'awards',       AWARD_SCHEMA));

    /* social */
    const social = member.social = member.social || {};
    form.appendChild(formRow('Google Scholar', el('input', {
      class: 'form-input', value: social.scholar || '', placeholder: 'https://scholar.google.com/...',
      oninput: (e) => social.scholar = e.target.value.trim()
    })));
    form.appendChild(formRow('ORCID', el('input', {
      class: 'form-input', value: social.orcid || '', placeholder: 'https://orcid.org/0000-...',
      oninput: (e) => social.orcid = e.target.value.trim()
    })));
    form.appendChild(formRow('ResearchGate', el('input', {
      class: 'form-input', value: social.researchgate || '', placeholder: 'https://www.researchgate.net/profile/...',
      oninput: (e) => social.researchgate = e.target.value.trim()
    })));
    form.appendChild(formRow('GitHub', el('input', {
      class: 'form-input', value: social.github || '', placeholder: 'https://github.com/...',
      oninput: (e) => social.github = e.target.value.trim()
    })));

    /* actions */
    const submitBtn = el('button', {class: 'btn-primary', type: 'submit'}, '保存');
    const cancelBtn = el('button', {class: 'btn-ghost',   type: 'button', onclick: opts.onCancel}, '取消');
    form.appendChild(el('div', {class: 'form-actions'}, submitBtn, cancelBtn, flash));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      flash.className = '';
      flash.textContent = '';

      if (!opts.lockSlug && !/^[a-z0-9-]+$/.test(member.slug)) {
        flash.className = 'err-flash';
        flash.textContent = 'slug 只能包含 a-z, 0-9, - ，不能为空。';
        return;
      }

      submitBtn.disabled = true; submitBtn.textContent = '保存中…';
      try {
        await opts.onSave(member);
        flash.className = 'ok-flash'; flash.textContent = '✓ 已保存';
      } catch (err) {
        flash.className = 'err-flash'; flash.textContent = '保存失败：' + err.message;
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = '保存';
      }
    });

    return form;
  }

  /* ============================================================
     Form row primitives
     ============================================================ */
  function formRow(label, controlEl, hint) {
    return el('div', {class: 'form-row'},
      el('label', null, label),
      el('div', {class: 'field'},
        controlEl,
        hint ? el('div', {class: 'field-hint'}, hint) : null
      )
    );
  }

  /* For string fields shaped {zh, en} */
  function bilingualRow(label, obj, key, opts) {
    obj[key] = obj[key] || { zh: '', en: '' };
    if (typeof obj[key] === 'string') obj[key] = { zh: obj[key], en: '' };
    const tag = opts && opts.textarea ? 'textarea' : 'input';
    const cls = opts && opts.textarea ? 'form-textarea' : 'form-input';
    const zhEl = el(tag, { class: cls, value: obj[key].zh || '',
      oninput: (e) => obj[key].zh = e.target.value });
    if (tag === 'textarea') zhEl.value = obj[key].zh || '';
    const enEl = el(tag, { class: cls, value: obj[key].en || '',
      oninput: (e) => obj[key].en = e.target.value });
    if (tag === 'textarea') enEl.value = obj[key].en || '';
    return el('div', {class: 'form-row bilingual'},
      el('label', null, label),
      el('div', {class: 'field'},
        el('div', {class: 'lang-pair'}, el('span', {class: 'lang-tag'}, '中文'), zhEl),
        el('div', {class: 'lang-pair'}, el('span', {class: 'lang-tag'}, 'English'), enEl)
      )
    );
  }

  /* For {zh: [string,...], en: [string,...]} — textarea, one paragraph per line */
  function bilingualStringsRow(label, obj, key, hint) {
    obj[key] = obj[key] || { zh: [], en: [] };
    if (Array.isArray(obj[key])) obj[key] = { zh: obj[key], en: [] };
    const zhTa = el('textarea', { class: 'form-textarea', rows: 4 });
    zhTa.value = (obj[key].zh || []).join('\n\n');
    zhTa.addEventListener('input', () => {
      obj[key].zh = zhTa.value.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    });
    const enTa = el('textarea', { class: 'form-textarea', rows: 4 });
    enTa.value = (obj[key].en || []).join('\n\n');
    enTa.addEventListener('input', () => {
      obj[key].en = enTa.value.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    });
    return el('div', {class: 'form-row bilingual'},
      el('label', null, label),
      el('div', {class: 'field'},
        el('div', {class: 'lang-pair'},
          el('span', {class: 'lang-tag'}, '中文（段落之间空一行）'),
          zhTa
        ),
        el('div', {class: 'lang-pair'},
          el('span', {class: 'lang-tag'}, 'English (blank line between paragraphs)'),
          enTa
        ),
        hint ? el('div', {class: 'field-hint'}, hint) : null
      )
    );
  }

  /* ============================================================
     Visual list editor (Phase 4c) — replaces the JSON textarea
     for the nested team-member fields (education, experience, etc.)
     ============================================================ */
  function listRow(label, obj, key, schema) {
    obj[key] = obj[key] || [];
    return el('div', {class: 'form-row'},
      el('label', null, label),
      el('div', {class: 'field'},
        buildListEditor(obj, key, schema)
      )
    );
  }

  function buildListEditor(parent, parentKey, schema) {
    const wrap = el('div', {class: 'list-editor'});

    function getArr() { return parent[parentKey]; }

    function rerender() {
      const arr = getArr();
      wrap.innerHTML = '';
      /* Optional toolbar above the list (e.g. "paste-and-parse" for publications) */
      if (Array.isArray(schema.toolbar) && schema.toolbar.length) {
        const tb = el('div', {class: 'list-editor-toolbar'});
        schema.toolbar.forEach(btn => {
          tb.appendChild(el('button', {
            type: 'button', class: 'btn-ghost btn-small',
            onclick: () => btn.onClick(arr, rerender)
          }, btn.label));
        });
        wrap.appendChild(tb);
      }
      arr.forEach((item, i) => wrap.appendChild(renderListItem(item, i, arr)));
      const addBtn = el('button', {
        type: 'button', class: 'btn-ghost btn-add',
        onclick: () => { arr.push(schema.itemDefault()); rerender(); }
      }, `+ 添加${schema.itemLabel || '一项'}`);
      wrap.appendChild(addBtn);
      if (arr.length === 0) {
        wrap.insertBefore(el('p', {class: 'muted', style: 'margin: 4px 0 0; font-size: 13px;'},
          `暂无${schema.itemLabel || '内容'}，点下面 + 添加。`), addBtn);
      }
    }

    function renderListItem(item, i, arr) {
      const summary = schema.summarize ? schema.summarize(item) : '';
      const card = el('div', {class: 'list-item-card'});
      card.appendChild(el('div', {class: 'list-item-head'},
        el('span', {class: 'list-item-num'}, '#' + (i + 1)),
        el('span', {class: 'list-item-summary'}, summary || '(未填)'),
        el('div', {class: 'list-item-actions'},
          el('button', {type: 'button', class: 'icon-btn', title: '上移',
            disabled: i === 0 ? 'disabled' : null,
            onclick: () => { swap(arr, i, i - 1); rerender(); }}, '↑'),
          el('button', {type: 'button', class: 'icon-btn', title: '下移',
            disabled: i === arr.length - 1 ? 'disabled' : null,
            onclick: () => { swap(arr, i, i + 1); rerender(); }}, '↓'),
          el('button', {type: 'button', class: 'icon-btn icon-btn-danger', title: '删除',
            onclick: () => {
              if (!confirm('确认删除此' + (schema.itemLabel || '条') + '？')) return;
              arr.splice(i, 1); rerender();
            }}, '×')
        )
      ));
      const body = el('div', {class: 'list-item-body'});
      schema.fields.forEach(f => body.appendChild(renderListField(item, f)));
      card.appendChild(body);
      return card;
    }

    function swap(arr, a, b) {
      if (a < 0 || b < 0 || a >= arr.length || b >= arr.length) return;
      const t = arr[a]; arr[a] = arr[b]; arr[b] = t;
    }

    rerender();
    return wrap;
  }

  function renderListField(item, field) {
    const row = el('div', {class: 'sub-row'});
    row.appendChild(el('label', null, field.label));
    const ctrl = el('div', {class: 'sub-ctrl'});
    switch (field.type) {
      case 'text':              ctrl.appendChild(makeTextInput(item, field)); break;
      case 'textarea':          ctrl.appendChild(makeTextarea(item, field));  break;
      case 'number':            ctrl.appendChild(makeNumberInput(item, field)); break;
      case 'select':            ctrl.appendChild(makeSelectInput(item, field)); break;
      case 'bool':              ctrl.appendChild(makeBoolInput(item, field));  break;
      case 'bilingual-text':    ctrl.appendChild(makeBilingualInputs(item, field, 'input')); break;
      case 'bilingual-textarea': ctrl.appendChild(makeBilingualInputs(item, field, 'textarea')); break;
      case 'image':             ctrl.appendChild(makeImageInput(item, field)); break;
      case 'lines':             ctrl.appendChild(makeLinesInput(item, field)); break;
      case 'nested-list': {
        item[field.key] = item[field.key] || [];
        ctrl.appendChild(buildListEditor(item, field.key, field.schema));
        break;
      }
      default: ctrl.textContent = '(未知字段类型: ' + field.type + ')';
    }
    if (field.hint) ctrl.appendChild(el('div', {class: 'field-hint'}, field.hint));
    row.appendChild(ctrl);
    return row;
  }

  function makeTextInput(item, field) {
    const v = item[field.key];
    const inp = el('input', { class: 'form-input', type: 'text',
      placeholder: field.placeholder || '', value: v != null ? v : '' });
    inp.addEventListener('input', () => item[field.key] = inp.value);
    return inp;
  }

  function makeTextarea(item, field) {
    const ta = el('textarea', { class: 'form-textarea',
      rows: field.rows || 3, placeholder: field.placeholder || '' });
    ta.value = item[field.key] != null ? item[field.key] : '';
    ta.addEventListener('input', () => item[field.key] = ta.value);
    return ta;
  }

  function makeNumberInput(item, field) {
    const inp = el('input', { class: 'form-input', type: 'number',
      placeholder: field.placeholder || '',
      value: item[field.key] != null ? item[field.key] : '' });
    inp.addEventListener('input', () => {
      if (inp.value === '') { item[field.key] = ''; return; }
      const n = Number(inp.value);
      item[field.key] = isNaN(n) ? inp.value : n;
    });
    return inp;
  }

  function makeSelectInput(item, field) {
    const sel = el('select', { class: 'form-select' });
    const empty = el('option', {value: ''}, '— ' + (field.emptyLabel || '不设') + ' —');
    if (!item[field.key]) empty.setAttribute('selected', '');
    sel.appendChild(empty);
    for (const opt of field.options || []) {
      const o = el('option', {value: opt.value}, opt.label);
      if (item[field.key] === opt.value) o.setAttribute('selected', '');
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => item[field.key] = sel.value);
    return sel;
  }

  function makeBoolInput(item, field) {
    const cb = el('input', {type: 'checkbox'});
    cb.checked = !!item[field.key];
    cb.addEventListener('change', () => item[field.key] = cb.checked);
    return el('label', {class: 'checkbox-label'}, cb, ' ', field.checkboxLabel || '是');
  }

  function makeBilingualInputs(item, field, tag) {
    /* normalize {zh,en} */
    const v = item[field.key];
    if (v == null) item[field.key] = { zh: '', en: '' };
    else if (typeof v === 'string') item[field.key] = { zh: v, en: '' };

    const cls = tag === 'textarea' ? 'form-textarea' : 'form-input';
    const placeZh = (field.placeholder && field.placeholder.zh) || '';
    const placeEn = (field.placeholder && field.placeholder.en) || '';

    const zh = el(tag, {class: cls, placeholder: placeZh});
    if (tag === 'textarea') zh.rows = field.rows || 2;
    zh.value = item[field.key].zh || '';
    zh.addEventListener('input', () => item[field.key].zh = zh.value);

    const en = el(tag, {class: cls, placeholder: placeEn});
    if (tag === 'textarea') en.rows = field.rows || 2;
    en.value = item[field.key].en || '';
    en.addEventListener('input', () => item[field.key].en = en.value);

    return el('div', {class: 'bilingual-inputs'},
      el('div', null, el('span', {class: 'lang-tag'}, '中文'), zh),
      el('div', null, el('span', {class: 'lang-tag'}, 'English'), en)
    );
  }

  /* Image input — small thumbnail + path field + upload button. Used inside
     list-item rows (compact form). For team-member's avatar see photoRow above. */
  function makeImageInput(item, field) {
    const wrap = el('div', {class: 'image-field-row'});
    const thumb = el('div', {class: 'image-thumb'});
    function renderThumb() {
      thumb.innerHTML = '';
      if (item[field.key]) {
        const img = el('img', {src: item[field.key], alt: ''});
        img.onerror = () => { thumb.innerHTML = '<i class="fa-solid fa-image"></i>'; };
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = '<i class="fa-solid fa-image"></i>';
      }
    }
    renderThumb();

    const pathInput = el('input', {
      class: 'form-input', type: 'text',
      placeholder: field.placeholder || 'assets/img/...',
      value: item[field.key] || ''
    });
    pathInput.addEventListener('input', () => {
      item[field.key] = pathInput.value.trim();
      renderThumb();
    });

    const fileInput = el('input', {
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml',
      style: 'display:none'
    });
    const status = el('span', {class: 'muted'});
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { status.className = 'err-flash'; status.textContent = '> 5MB'; return; }
      status.className = 'muted'; status.textContent = '上传中…';
      const fd = new FormData();
      fd.append('dir', field.uploadDir || 'uploads');  /* dir BEFORE photo so multer sees it */
      fd.append('photo', f);
      try {
        const res = await api('POST', '/api/upload', fd);
        item[field.key] = res.path;
        pathInput.value = res.path;
        renderThumb();
        status.className = 'ok-flash'; status.textContent = '✓';
      } catch (e) {
        status.className = 'err-flash'; status.textContent = '失败：' + e.message;
      } finally {
        fileInput.value = '';
      }
    });

    const pickBtn  = el('button', {type: 'button', class: 'btn-ghost btn-small', onclick: () => fileInput.click()}, '选择');
    const clearBtn = el('button', {type: 'button', class: 'btn-link',
      onclick: () => { item[field.key] = ''; pathInput.value = ''; renderThumb(); status.textContent = ''; }
    }, '清除');

    wrap.appendChild(thumb);
    wrap.appendChild(el('div', {class: 'image-field-controls'},
      pathInput,
      el('div', {class: 'image-field-buttons'}, pickBtn, clearBtn, status, fileInput)
    ));
    return wrap;
  }

  /* Lines input — textarea where each line is one element of a string array. */
  function makeLinesInput(item, field) {
    const ta = el('textarea', { class: 'form-textarea',
      rows: field.rows || 5, placeholder: field.placeholder || '' });
    const arr = item[field.key];
    ta.value = (Array.isArray(arr) ? arr : (arr ? [arr] : [])).join('\n');
    ta.addEventListener('input', () => {
      item[field.key] = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
    });
    return ta;
  }

  /* ============ Schemas for nested team-member fields ============ */
  const EDU_SCHEMA = {
    itemLabel: '学校',
    itemDefault: () => ({ institution: {zh:'',en:''}, logo: '', logoStyle: '',
      levels: [{ degree: {zh:'',en:''}, field: {zh:'',en:''}, period: '' }] }),
    summarize: (e) => {
      const i = (e.institution && (e.institution.zh || e.institution.en)) || '';
      const n = (e.levels || []).length;
      return i ? `${i}（${n} 个学位）` : '(未填学校)';
    },
    fields: [
      { key: 'institution', label: '学校', type: 'bilingual-text',
        placeholder: { zh: '安徽医科大学', en: 'Anhui Medical University' } },
      { key: 'logo', label: 'Logo', type: 'image', uploadDir: 'uploads',
        hint: '没有可留空。' },
      { key: 'logoStyle', label: 'Logo 样式', type: 'text',
        hint: '一般留空。AHMU 红底背景填 "on-ahmu-red"。' },
      { key: 'levels', label: '学位列表', type: 'nested-list', schema: {
        itemLabel: '学位',
        itemDefault: () => ({ degree: {zh:'',en:''}, field: {zh:'',en:''}, period: '' }),
        summarize: (lv) => {
          const d = (lv.degree && (lv.degree.zh || lv.degree.en)) || '';
          const f = (lv.field  && (lv.field.zh  || lv.field.en))  || '';
          return [d, f].filter(Boolean).join(' · ');
        },
        fields: [
          { key: 'degree', label: '学位',  type: 'bilingual-text',
            placeholder: { zh: '博士 Ph.D.', en: 'Ph.D.' } },
          { key: 'field',  label: '专业',  type: 'bilingual-text',
            placeholder: { zh: '泌尿外科学', en: 'Urology' } },
          { key: 'period', label: '时间段', type: 'text',
            placeholder: '2023.09 – 至今' }
        ]
      } }
    ]
  };

  const EXP_SCHEMA = {
    itemLabel: '工作单位',
    itemDefault: () => ({ logo: '', logoStyle: '', alt: {zh:'',en:''},
      roles: [{ detail: {zh:'',en:''}, period: '' }] }),
    summarize: (e) => {
      const a = (e.alt && (e.alt.zh || e.alt.en)) || '';
      const n = (e.roles || []).length;
      return a ? `${a}（${n} 个角色）` : '(未填单位)';
    },
    fields: [
      { key: 'alt', label: '单位名', type: 'bilingual-text',
        placeholder: { zh: '安徽医科大学', en: 'Anhui Medical University' } },
      { key: 'logo', label: 'Logo', type: 'image', uploadDir: 'uploads' },
      { key: 'logoStyle', label: 'Logo 样式', type: 'text',
        hint: '一般留空。AHMU 红底用 "on-ahmu-red"。' },
      { key: 'roles', label: '角色 / 职位', type: 'nested-list', schema: {
        itemLabel: '角色',
        itemDefault: () => ({ detail: {zh:'',en:''}, period: '' }),
        summarize: (r) => (r.detail && (r.detail.zh || r.detail.en)) || '(未填)',
        fields: [
          { key: 'detail', label: '岗位 / 详情', type: 'bilingual-text',
            placeholder: { zh: '实验室助理', en: 'Lab Assistant' } },
          { key: 'period', label: '时间段', type: 'text',
            placeholder: '2023.09 – 至今' }
        ]
      } }
    ]
  };

  const PROJECT_SCHEMA = {
    itemLabel: '项目',
    itemDefault: () => ({ title: {zh:'',en:''}, description: {zh:'',en:''}, period: '', status: {zh:'',en:''} }),
    summarize: (p) => (p.title && (p.title.zh || p.title.en)) || '(未填项目)',
    fields: [
      { key: 'title',       label: '项目名称', type: 'bilingual-text' },
      { key: 'description', label: '简介 / 子标题', type: 'bilingual-textarea', rows: 2 },
      { key: 'period',      label: '时间段', type: 'text', placeholder: '2024.01 – 2025.12' },
      { key: 'status',      label: '状态',   type: 'bilingual-text',
        placeholder: { zh: '在研', en: 'Ongoing' } }
    ]
  };

  const PUB_SCHEMA = {
    itemLabel: '论文',
    itemDefault: () => ({
      year: new Date().getFullYear(), type: 'Article', role: '',
      title: '', authors: '', journal: '', volume: '', doi: '', link: '',
      if: '', casZone: '', jcrZone: '', isTop: false, image: ''
    }),
    summarize: (p) => {
      const t = (p.title || '').slice(0, 50);
      return [p.year, p.type, t || '(未填)'].filter(Boolean).join(' · ');
    },
    toolbar: [
      { label: '📥 粘贴参考文献自动解析',
        onClick: (arr, refresh) => openParseRefDialog(arr, refresh) }
    ],
    fields: [
      { key: 'year', label: '年份', type: 'number', placeholder: '2025' },
      { key: 'type', label: '类型', type: 'select', emptyLabel: '不设',
        options: [
          { value: 'Article', label: 'Article' },
          { value: 'Letter',  label: 'Letter' },
          { value: 'Review',  label: 'Review' }
        ] },
      { key: 'role', label: '署名身份', type: 'select', emptyLabel: '不显示',
        options: [
          { value: 'first',            label: '第一作者' },
          { value: 'co-first',         label: '共同第一作者' },
          { value: 'corresponding',    label: '通讯作者' },
          { value: 'co-corresponding', label: '共同通讯作者' }
        ] },
      { key: 'title',   label: '标题',     type: 'textarea', rows: 2 },
      { key: 'authors', label: '作者列表', type: 'textarea', rows: 2,
        hint: '原样填写。# 表共同一作；* 表通讯。Meng Jialin / Jialin Meng 自动加粗。' },
      { key: 'journal', label: '期刊', type: 'text' },
      { key: 'volume',  label: '卷期/页码', type: 'text', placeholder: '44(8):116123' },
      { key: 'doi',     label: 'DOI', type: 'text', placeholder: '10.xxx/yyy',
        hint: '不要带 https://doi.org/ 前缀，系统会自动加。' },
      { key: 'link',    label: '自定义链接', type: 'text',
        hint: '留空则用 DOI 自动生成。' },
      { key: 'if',      label: '影响因子 IF', type: 'text', placeholder: '5.0' },
      { key: 'casZone', label: '中科院分区', type: 'text', placeholder: '1' },
      { key: 'jcrZone', label: 'JCR 分区',   type: 'text', placeholder: '1' },
      { key: 'isTop',   label: 'Top 期刊',   type: 'bool', checkboxLabel: '标记为 Top 期刊' },
      { key: 'image',   label: '缩略图', type: 'image', uploadDir: 'uploads' }
    ]
  };

  const AWARD_SCHEMA = {
    itemLabel: '奖项',
    itemDefault: () => ({ year: '', text: { zh: '', en: '' } }),
    summarize: (a) => {
      const t = (a.text && (a.text.zh || a.text.en)) || '';
      return [a.year, t || '(未填)'].filter(Boolean).join(' · ');
    },
    fields: [
      { key: 'year', label: '年份',     type: 'text', placeholder: '2025' },
      { key: 'text', label: '奖项内容', type: 'bilingual-textarea', rows: 2 }
    ]
  };

  /* ============================================================
     Single-language schemas for the FRAMEWORK section panels.
     The team-member form (above) uses bilingual {zh,en} per item.
     The framework /api/data/<section> returns {zh:[...], en:[...]}
     where each array's items are single-language. So separate schemas.
     ============================================================ */
  const EDU_SECTION_SCHEMA = {
    itemLabel: '学校',
    itemDefault: () => ({ institution: '', logo: '', logoStyle: '',
      levels: [{ degree: '', field: '', period: '' }] }),
    summarize: e => e.institution ? `${e.institution}（${(e.levels||[]).length} 个学位）` : '(未填学校)',
    fields: [
      { key: 'institution', label: '学校名', type: 'text' },
      { key: 'logo', label: 'Logo', type: 'image', uploadDir: 'uploads' },
      { key: 'logoStyle', label: 'Logo 样式', type: 'text', hint: 'AHMU 红底用 "on-ahmu-red"' },
      { key: 'levels', label: '学位', type: 'nested-list', schema: {
        itemLabel: '学位',
        itemDefault: () => ({ degree: '', field: '', period: '' }),
        summarize: lv => [lv.degree, lv.field].filter(Boolean).join(' · ') || '(未填)',
        fields: [
          { key: 'degree', label: '学位', type: 'text', placeholder: '博士 Ph.D.' },
          { key: 'field',  label: '专业', type: 'text', placeholder: '泌尿外科学' },
          { key: 'period', label: '时间段', type: 'text', placeholder: '2023.09 – 至今' }
        ]
      } }
    ]
  };

  const EXP_SECTION_SCHEMA = {
    itemLabel: '工作单位',
    itemDefault: () => ({ logo: '', logoStyle: '', alt: '',
      roles: [{ detail: '', period: '' }] }),
    summarize: e => e.alt ? `${e.alt}（${(e.roles||[]).length} 个角色）` : '(未填单位)',
    fields: [
      { key: 'alt', label: '单位名', type: 'text' },
      { key: 'logo', label: 'Logo', type: 'image', uploadDir: 'uploads' },
      { key: 'logoStyle', label: 'Logo 样式', type: 'text', hint: 'AHMU 红底用 "on-ahmu-red"' },
      { key: 'roles', label: '角色', type: 'nested-list', schema: {
        itemLabel: '角色',
        itemDefault: () => ({ detail: '', period: '' }),
        summarize: r => r.detail || '(未填)',
        fields: [
          { key: 'detail', label: '岗位 / 详情', type: 'text' },
          { key: 'period', label: '时间段', type: 'text' }
        ]
      } }
    ]
  };

  const PROJECT_SECTION_SCHEMA = {
    itemLabel: '项目',
    itemDefault: () => ({ title: '', description: '', period: '', status: '' }),
    summarize: p => p.title || '(未填项目)',
    fields: [
      { key: 'title',       label: '项目名', type: 'text' },
      { key: 'description', label: '简介',   type: 'textarea', rows: 2 },
      { key: 'period',      label: '时间段', type: 'text', placeholder: '2024.01 – 2025.12' },
      { key: 'status',      label: '状态',   type: 'text', placeholder: '在研' }
    ]
  };

  const AWARD_SECTION_SCHEMA = {
    itemLabel: '奖项',
    itemDefault: () => ({ year: '', text: '' }),
    summarize: a => `${a.year || '?'} · ${(a.text || '').slice(0, 60) || '(未填)'}`,
    fields: [
      { key: 'year', label: '年份', type: 'text' },
      { key: 'text', label: '内容', type: 'textarea', rows: 2,
        hint: '允许 HTML（如 <strong>...</strong>）' }
    ]
  };

  const RESEARCH_SECTION_SCHEMA = {
    itemLabel: '研究方向',
    itemDefault: () => ({ name: '', title: '', image: '', points: [] }),
    summarize: r => r.title || r.name || '(未填)',
    fields: [
      { key: 'name',  label: 'name (id)', type: 'text', hint: '内部 id，可选；不显示。' },
      { key: 'title', label: '标题', type: 'text' },
      { key: 'image', label: '配图', type: 'image', uploadDir: 'uploads' },
      { key: 'points', label: '要点', type: 'lines', rows: 5,
        hint: '每行一条要点；允许 HTML。' }
    ]
  };

  const TOOL_SECTION_SCHEMA = {
    itemLabel: '工具',
    itemDefault: () => ({ name: '', type: '', description: '', image: '', link: '' }),
    summarize: t => t.name || '(未填)',
    fields: [
      { key: 'name',        label: '名称',  type: 'text' },
      { key: 'type',        label: '分类',  type: 'text', placeholder: '数据库 / 软件 / ...' },
      { key: 'description', label: '描述',  type: 'textarea', rows: 3,
        hint: '允许 HTML。' },
      { key: 'image',       label: '截图',  type: 'image', uploadDir: 'uploads' },
      { key: 'link',        label: '链接',  type: 'text', placeholder: 'https://...' }
    ]
  };

  /* Map section name → list-editor schema (for the admin section panels).
     `about` is special (string array, simple textarea pair, no list editor).
     `publications` reuses PUB_SCHEMA (it was already single-language). */
  const SECTION_LIST_SCHEMAS = {
    education:    EDU_SECTION_SCHEMA,
    experience:   EXP_SECTION_SCHEMA,
    projects:     PROJECT_SECTION_SCHEMA,
    awards:       AWARD_SECTION_SCHEMA,
    research:     RESEARCH_SECTION_SCHEMA,
    tools:        TOOL_SECTION_SCHEMA,
    publications: PUB_SCHEMA
  };

  /* ============================================================
     Reference parser — best-effort regex for the "paste & parse" button
     ============================================================ */
  function parseRef(text) {
    const out = { type: 'Article' };
    let work = String(text || '').trim();
    if (!work) return out;

    const doiM = work.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi[:\s]+)\s*(10\.\S+?)(?=[.,)\s]|$)/i);
    if (doiM) {
      out.doi = doiM[1].replace(/[.,)]+$/, '');
      work = work.replace(doiM[0], '').trim();
    }

    const parens = (work.match(/[(（][^()（）]+[)）]/g) || []);
    let meta = parens.join(' ');
    parens.forEach(p => work = work.replace(p, ''));

    if (/Letter|letter|快讯|来信/.test(meta + work))      out.type = 'Letter';
    else if (/Review|review|综述/.test(meta + work))     out.type = 'Review';

    const roleSrc = meta + ' ' + work;
    if (/共同第一/.test(roleSrc))                       out.role = 'co-first';
    else if (/第一作者|first author/i.test(roleSrc))    out.role = 'first';
    else if (/共同通讯/.test(roleSrc))                  out.role = 'co-corresponding';
    else if (/通讯作者|corresponding/i.test(roleSrc))   out.role = 'corresponding';

    const ifM  = (meta + work).match(/IF\s*[=：:]\s*([\d.]+)/i);
    if (ifM) out.if = ifM[1];
    const casM = (meta + work).match(/中科院\s*(\d)\s*区/);
    if (casM) out.casZone = casM[1];
    const jcrM = (meta + work).match(/JCR\s*Q?\s*(\d)/i);
    if (jcrM) out.jcrZone = jcrM[1];
    if (/Top\b|top journal/i.test(meta)) out.isTop = true;

    const yearM = work.match(/\b(19|20)\d{2}\b/);
    if (yearM) out.year = Number(yearM[0]);

    work = work.replace(/\s+/g, ' ').trim().replace(/^[\s.,;]+|[\s.,;]+$/g, '');
    const parts = work.split(/\.\s+(?=[A-Z一-龥])/);
    if (parts.length >= 3) {
      out.authors = parts[0].trim().replace(/^[\s.,;]+|[\s.,;]+$/g, '');
      out.title   = parts[1].trim().replace(/^[\s.,;]+|[\s.,;]+$/g, '');
      const rest = parts.slice(2).join('. ').trim();
      const segs = rest.split(/\s*,\s*/);
      out.journal = (segs[0] || '').trim();
      if (segs.length >= 3) out.volume = segs.slice(2).join(', ').trim().replace(/^[\s.,]+|[\s.,]+$/g, '');
      else if (segs.length === 2 && !/^\d{4}$/.test(segs[1].trim())) out.volume = segs[1].trim();
    } else if (parts.length === 2) {
      out.authors = parts[0].trim();
      out.title   = parts[1].trim();
    } else {
      out.title = work;
    }
    return out;
  }

  function openParseRefDialog(arr, refresh) {
    let parsed = null;
    const taInput = el('textarea', {
      class: 'form-textarea', rows: 5,
      placeholder: '示例：\nYang F#, Zhang X#, Liang C*, Meng J*. Multivariate analysis of sarcopenia ... Experimental Gerontology, 2025, 206:112783. doi:10.xxx/yyy. ([Article], 通讯作者, IF=3.3, 中科院 3 区, JCR 2 区)'
    });
    const previewWrap = el('div', {class: 'parse-preview', style: 'display:none;'});
    const confirmBtn  = el('button', {class: 'btn-primary', disabled: 'disabled'}, '确认添加');
    const cancelBtn   = el('button', {class: 'btn-ghost'}, '取消');
    const parseBtn    = el('button', {class: 'btn-ghost'}, '解析 →');

    const dialog = el('div', {class: 'dialog-backdrop',
      onclick: (e) => { if (e.target.classList.contains('dialog-backdrop')) close(); }},
      el('div', {class: 'dialog-box dialog-wide'},
        el('h3', null, '📥 从参考文献自动解析'),
        el('p', {class: 'muted'}, '粘贴一段参考文献，点解析。识别字段会显示在下方，确认后点添加；解析仅作建议，添加后可在卡片里继续修改。'),
        taInput,
        el('div', {class: 'dialog-actions'}, parseBtn),
        previewWrap,
        el('div', {class: 'dialog-actions'}, cancelBtn, confirmBtn)
      )
    );
    document.body.appendChild(dialog);
    setTimeout(() => taInput.focus(), 50);

    cancelBtn.addEventListener('click', close);
    parseBtn.addEventListener('click', () => {
      const text = taInput.value.trim();
      if (!text) return;
      parsed = parseRef(text);
      previewWrap.style.display = 'block';
      previewWrap.innerHTML = '';
      const dl = el('dl', {class: 'parse-dl'});
      const order = ['year','type','role','title','authors','journal','volume','doi','if','casZone','jcrZone','isTop'];
      order.forEach(k => {
        const v = parsed[k];
        if (v == null || v === '' || v === false) return;
        dl.appendChild(el('dt', null, k));
        dl.appendChild(el('dd', null, String(v)));
      });
      previewWrap.appendChild(dl);
      confirmBtn.disabled = false;
    });
    confirmBtn.addEventListener('click', () => {
      if (!parsed) return;
      arr.unshift({ ...PUB_SCHEMA.itemDefault(), ...parsed });
      refresh();
      close();
    });
    function close() { dialog.remove(); }
  }

  /* ============================================================
     Section panels (Phase 4d) — replace the JSON textareas with
     visual list editors for admin's about/education/.../publications tabs.
     ============================================================ */
  const SECTION_TITLES = {
    about:        { title: 'About 简介',         intro: '主页 About 段落。每段独立一行，段与段之间空一行。允许 HTML。' },
    education:    { title: 'Education 教育',     intro: '教育经历（适用于主页 + Education 分页）。' },
    experience:   { title: 'Experience 经历',    intro: '工作经历。' },
    projects:     { title: 'Projects 基金 / 项目', intro: '基金或科研项目。' },
    awards:       { title: 'Awards 奖项',        intro: '获奖记录。' },
    research:     { title: 'Research 研究方向',  intro: '研究方向（含要点列表 + 配图）。' },
    tools:        { title: 'Tools 工具 / 资源',  intro: '工具、数据库、资源链接。' },
    publications: { title: 'Publications 论文', intro: '发表论文。可粘贴一段参考文献自动解析。' }
  };

  async function renderSectionTab(main, section) {
    const data = await api('GET', '/api/data/' + section);
    const meta = SECTION_TITLES[section] || { title: section, intro: '' };
    main.innerHTML = '';
    main.appendChild(el('h2', null, meta.title));
    if (meta.intro) main.appendChild(el('p', {class: 'muted', style: 'margin: -8px 0 14px'}, meta.intro));

    if (section === 'about') {
      renderAboutPanel(main, section, data);
    } else if (section in SECTION_LIST_SCHEMAS) {
      renderListSectionPanel(main, section, data, SECTION_LIST_SCHEMAS[section]);
    } else {
      renderJsonFallback(main, section, data);
    }
  }

  function renderAboutPanel(main, section, data) {
    if (!data || typeof data !== 'object') data = { zh: [], en: [] };
    const zhTa = el('textarea', {class: 'form-textarea', rows: 10,
      placeholder: '段落 1\n\n段落 2\n\n…' });
    zhTa.value = (Array.isArray(data.zh) ? data.zh : []).join('\n\n');
    const enTa = el('textarea', {class: 'form-textarea', rows: 10,
      placeholder: 'Paragraph 1\n\nParagraph 2' });
    enTa.value = (Array.isArray(data.en) ? data.en : []).join('\n\n');

    main.appendChild(el('div', {class: 'bilingual-json'},
      el('div', null, el('span', {class: 'lang-tag'}, '中文 (zh)'), zhTa),
      el('div', null, el('span', {class: 'lang-tag'}, 'English (en)'), enTa)
    ));

    const flash = el('div');
    main.appendChild(el('div', {class: 'form-actions'},
      el('button', {class: 'btn-primary', onclick: save}, '保存'),
      el('button', {class: 'btn-ghost', onclick: () => selectTab(section)}, '重置'),
      flash
    ));

    async function save() {
      flash.className = ''; flash.textContent = '';
      const zh = zhTa.value.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
      const en = enTa.value.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
      try {
        await api('PUT', '/api/data/about', { zh, en });
        flash.className = 'ok-flash'; flash.textContent = '✓ 已保存';
      } catch (e) {
        flash.className = 'err-flash'; flash.textContent = '保存失败：' + e.message;
      }
    }
  }

  function renderListSectionPanel(main, section, data, schema) {
    if (!data || typeof data !== 'object') data = { zh: [], en: [] };
    if (!Array.isArray(data.zh)) data.zh = [];
    if (!Array.isArray(data.en)) data.en = [];

    const langState = { current: 'zh' };
    const tabZh = el('button', {class: 'lang-subtab is-active', 'data-lang': 'zh'},
      `中文 (${data.zh.length})`);
    const tabEn = el('button', {class: 'lang-subtab', 'data-lang': 'en'},
      `English (${data.en.length})`);
    main.appendChild(el('div', {class: 'lang-subtabs'}, tabZh, tabEn));

    const editorWrap = el('div');
    main.appendChild(editorWrap);

    function renderLang() {
      editorWrap.innerHTML = '';
      editorWrap.appendChild(buildListEditor(data, langState.current, schema));
    }
    function selectLang(lang) {
      langState.current = lang;
      tabZh.classList.toggle('is-active', lang === 'zh');
      tabEn.classList.toggle('is-active', lang === 'en');
      renderLang();
    }
    tabZh.addEventListener('click', () => selectLang('zh'));
    tabEn.addEventListener('click', () => selectLang('en'));
    renderLang();

    const flash = el('div');
    main.appendChild(el('div', {class: 'form-actions'},
      el('button', {class: 'btn-primary', onclick: save}, '保存'),
      el('button', {class: 'btn-ghost', onclick: () => selectTab(section)}, '重置（重新加载）'),
      flash
    ));

    async function save() {
      flash.className = ''; flash.textContent = '';
      try {
        await api('PUT', '/api/data/' + section, { zh: data.zh, en: data.en });
        flash.className = 'ok-flash'; flash.textContent = '✓ 已保存';
        tabZh.textContent = `中文 (${data.zh.length})`;
        tabEn.textContent = `English (${data.en.length})`;
      } catch (e) {
        flash.className = 'err-flash'; flash.textContent = '保存失败：' + e.message;
      }
    }
  }

  function renderJsonFallback(main, section, data) {
    const ta = el('textarea', { class: 'form-textarea json-textarea', rows: 22 });
    ta.value = JSON.stringify(data, null, 2);
    main.appendChild(ta);
    const flash = el('div');
    main.appendChild(el('div', {class: 'form-actions'},
      el('button', {class: 'btn-primary', onclick: save}, '保存'),
      el('button', {class: 'btn-ghost', onclick: () => selectTab(section)}, '重置'),
      flash
    ));
    async function save() {
      flash.className = ''; flash.textContent = '';
      let parsed;
      try { parsed = JSON.parse(ta.value); }
      catch (e) { flash.className = 'err-flash'; flash.textContent = 'JSON 错误：' + e.message; return; }
      try {
        await api('PUT', '/api/data/' + section, parsed);
        flash.className = 'ok-flash'; flash.textContent = '✓ 已保存';
      } catch (e) {
        flash.className = 'err-flash'; flash.textContent = '保存失败：' + e.message;
      }
    }
  }

  /* Photo upload + preview */
  function photoRow(member) {
    const previewWrap = el('div', {class: 'photo-preview'});
    function renderPreview() {
      previewWrap.innerHTML = '';
      if (member.photo) {
        const img = el('img', {src: member.photo, alt: 'photo'});
        img.onerror = () => { previewWrap.innerHTML = '<i class="fa-solid fa-user"></i>'; };
        previewWrap.appendChild(img);
      } else {
        previewWrap.innerHTML = '<i class="fa-solid fa-user"></i>';
      }
    }
    renderPreview();

    const fileInput = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', style: 'display:none' });
    const status = el('span', {class: 'muted'});
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { status.textContent = '文件超过 5MB'; status.className = 'err-flash'; return; }
      status.className = 'muted'; status.textContent = '上传中…';
      const fd = new FormData();
      fd.append('photo', f);
      if (member.slug) fd.append('slug', member.slug);
      try {
        const res = await api('POST', '/api/upload', fd);
        member.photo = res.path;
        renderPreview();
        pathInput.value = res.path;
        status.className = 'ok-flash'; status.textContent = '✓ 上传成功';
      } catch (e) {
        status.className = 'err-flash'; status.textContent = '上传失败：' + e.message;
      } finally {
        fileInput.value = '';
      }
    });

    const pickBtn = el('button', {class: 'btn-ghost', type: 'button',
      onclick: () => fileInput.click()
    }, '选择新照片');
    const clearBtn = el('button', {class: 'btn-link', type: 'button',
      onclick: () => { member.photo = ''; pathInput.value = ''; renderPreview(); status.textContent = ''; }
    }, '清除');

    const pathInput = el('input', {
      class: 'form-input', value: member.photo || '', placeholder: 'assets/img/team/...',
      oninput: (e) => { member.photo = e.target.value.trim(); renderPreview(); }
    });

    return el('div', {class: 'form-row photo-row'},
      el('label', null, '照片 / Photo'),
      el('div', {class: 'field'},
        previewWrap,
        el('div', {class: 'photo-controls'},
          el('div', {style: 'display:flex; gap:8px; align-items:center;'}, pickBtn, clearBtn, status, fileInput),
          pathInput,
          el('div', {class: 'field-hint'}, 'JPEG / PNG / WebP / GIF，单张 ≤ 5 MB。也可手动填路径（如已有 LXH_9648.jpg）。')
        )
      )
    );
  }

  /* ============================================================
     Section: Users (admin)
     ============================================================ */
  async function renderUsersTab(main) {
    const users = await api('GET', '/api/users');
    const team = await api('GET', '/api/data/team').catch(() => []);
    main.innerHTML = '';
    main.appendChild(el('h2', null, '用户账号'));
    main.appendChild(el('div', {class: 'panel-toolbar'},
      el('button', {class: 'btn-primary', onclick: () => openUserDialog(main, null, team)}, '+ 添加账号')
    ));

    const tbl = el('table', {class: 'users-table'},
      el('thead', null,
        el('tr', null,
          el('th', null, '账号'),
          el('th', null, '角色'),
          el('th', null, '绑定成员 (memberSlug)'),
          el('th', null, '操作')
        )
      )
    );
    const tbody = el('tbody');
    Object.entries(users).forEach(([username, info]) => {
      tbody.appendChild(el('tr', null,
        el('td', null, username),
        el('td', null, el('span', {class: 'role-pill'}, info.role)),
        el('td', null, info.memberSlug || '—'),
        el('td', null,
          el('button', {class: 'btn-ghost', onclick: () => openUserDialog(main, { username, ...info }, team)}, '编辑'),
          ' ',
          username === me.username
            ? el('span', {class: 'muted'}, '（当前账号）')
            : el('button', {class: 'btn-danger', onclick: () => deleteUser(main, username)}, '删除')
        )
      ));
    });
    tbl.appendChild(tbody);
    main.appendChild(tbl);
  }

  async function deleteUser(main, username) {
    if (!confirm(`删除账号 "${username}"？`)) return;
    try { await api('DELETE', '/api/users/' + encodeURIComponent(username)); }
    catch (e) { alert('删除失败：' + e.message); return; }
    await renderUsersTab(main);
  }

  /* New user dialog has 5 role choices: admin / Co-PI / PhD / Master / UG.
     Picking a team role auto-creates a Team entry alongside the account
     (one click instead of two-tab dance). The slug is auto-generated as
     `<team-role>-<username>` but editable. Admin can also bind to an
     existing Team slug instead of creating a new entry. */
  function openUserDialog(main, existing, team) {
    const isNew = !existing;
    if (isNew) return openCreateUserDialog(main, team);
    return openEditUserDialog(main, existing, team);
  }

  function openCreateUserDialog(main, team) {
    const data = {
      username: '', password: '',
      role: 'phd',           // admin | copi | phd | master | ug
      mode: 'new',           // new | bind
      memberSlug: '',        // when mode=bind
      newSlug: '',           // when mode=new (auto-generated)
      newSlugTouched: false, // user manually edited slug?
      nameZh: '', nameEn: ''
    };

    function autoSlug() {
      if (data.role === 'admin') return '';
      const u = (data.username || '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      return u ? `${data.role}-${u}` : '';
    }
    function refreshAutoSlug() {
      if (!data.newSlugTouched) data.newSlug = autoSlug();
      slugInput.value = data.newSlug;
    }

    const usernameInput = el('input', {
      class: 'form-input', value: '', placeholder: 'a-z, 0-9, _, -',
      oninput: (e) => { data.username = e.target.value.trim(); refreshAutoSlug(); }
    });
    const passwordInput = el('input', {
      class: 'form-input', type: 'text', value: '123456',
      placeholder: '至少 6 位（默认 123456）',
      oninput: (e) => data.password = e.target.value
    });
    /* Pre-fill the default so a click-through admin can ship 123456 quickly. */
    data.password = '123456';

    /* Role: admin OR a team role (copi/phd/master/ug) */
    const roleSelect = el('select', {class: 'form-select'});
    [['admin', '管理员 (admin) — 不对应团队成员'],
     ['copi',   'Co-PI — 同时在 Team 加一条 Co-PI 卡'],
     ['phd',    '博士研究生 (PhD) — 同时在 Team 加一条 PhD 卡'],
     ['master', '硕士研究生 (Master) — 同时在 Team 加一条 Master 卡'],
     ['ug',     '本科生 (UG) — 同时在 Team 加一条 UG 卡']
    ].forEach(([v, label]) => {
      const o = el('option', {value: v}, label);
      if (v === data.role) o.setAttribute('selected', '');
      roleSelect.appendChild(o);
    });
    roleSelect.addEventListener('change', () => {
      data.role = roleSelect.value;
      teamPanel.style.display = data.role === 'admin' ? 'none' : '';
      refreshAutoSlug();
    });

    /* Team panel: shown only for non-admin roles */
    const modeNew  = el('input', {type: 'radio', name: 'team-mode', value: 'new',  checked: 'checked'});
    const modeBind = el('input', {type: 'radio', name: 'team-mode', value: 'bind'});
    [modeNew, modeBind].forEach(r => r.addEventListener('change', () => {
      data.mode = modeNew.checked ? 'new' : 'bind';
      newFields.style.display  = data.mode === 'new'  ? '' : 'none';
      bindFields.style.display = data.mode === 'bind' ? '' : 'none';
    }));

    const nameZhInput = el('input', {class: 'form-input', placeholder: '张三',
      oninput: (e) => data.nameZh = e.target.value });
    const nameEnInput = el('input', {class: 'form-input', placeholder: 'Zhang San',
      oninput: (e) => data.nameEn = e.target.value });
    const slugInput = el('input', {class: 'form-input', placeholder: 'phd-zhangsan',
      oninput: (e) => { data.newSlug = e.target.value.trim(); data.newSlugTouched = true; }
    });

    const newFields = el('div', {style: 'display: flex; flex-direction: column; gap: 10px; padding-left: 18px; border-left: 2px solid var(--luka-border); margin: 6px 0 10px;'},
      formRow('姓名 (中文)', nameZhInput),
      formRow('姓名 (English)', nameEnInput),
      formRow('Slug', slugInput, '自动生成自 username，可改。建议格式：<role>-<name>。')
    );

    const bindSelect = el('select', {class: 'form-select',
      onchange: (e) => data.memberSlug = e.target.value });
    bindSelect.appendChild(el('option', {value: ''}, '— 选择已有 Team 成员 —'));
    team.forEach(m => bindSelect.appendChild(el('option', {value: m.slug}, `${m.slug}  (${m.role})`)));

    const bindFields = el('div', {style: 'display: none; padding-left: 18px; border-left: 2px solid var(--luka-border); margin: 6px 0 10px;'},
      formRow('选 Team 成员', bindSelect, '该账号将编辑这条已有的成员卡，不新建。')
    );

    const teamPanel = el('div', {style: data.role === 'admin' ? 'display: none;' : ''},
      el('div', {class: 'form-row'},
        el('label', null, '团队成员'),
        el('div', {class: 'field'},
          el('label', {class: 'checkbox-label'}, modeNew, ' 新建一条 Team 卡'),
          el('label', {class: 'checkbox-label'}, modeBind, ' 绑定到已有 Team 成员')
        )
      ),
      newFields,
      bindFields
    );

    const flash = el('div');
    const dialog = el('div', {class: 'dialog-backdrop',
      onclick: (e) => { if (e.target.classList.contains('dialog-backdrop')) close(); }},
      el('div', {class: 'dialog-box dialog-wide'},
        el('h3', null, '添加账号'),
        formRow('账号 username', usernameInput, '只能用 a-z, 0-9, _, - ，最多 32 位。'),
        formRow('密码', passwordInput, '至少 6 位。默认 123456，建议告诉学生首次登录后用「改密码」改成自己的。'),
        formRow('角色', roleSelect),
        teamPanel,
        flash,
        el('div', {class: 'dialog-actions'},
          el('button', {class: 'btn-ghost', onclick: close}, '取消'),
          el('button', {class: 'btn-primary', onclick: save}, '创建')
        )
      )
    );
    document.body.appendChild(dialog);

    function close() { dialog.remove(); }

    async function save() {
      flash.className = ''; flash.textContent = '';
      if (!/^[a-z0-9_-]+$/i.test(data.username) || data.username.length > 32) {
        flash.className = 'err-flash'; flash.textContent = '账号格式不对（a-z, 0-9, _, - ）'; return;
      }
      if (!data.password || data.password.length < 6) {
        flash.className = 'err-flash'; flash.textContent = '密码至少 6 位'; return;
      }

      /* Admin path: just create the user. */
      if (data.role === 'admin') {
        try {
          await api('PUT', '/api/users/' + encodeURIComponent(data.username),
            { role: 'admin', password: data.password });
          close();
          await renderUsersTab(main);
        } catch (e) {
          flash.className = 'err-flash'; flash.textContent = '失败：' + e.message;
        }
        return;
      }

      /* Member path: also touch the team list. */
      let memberSlug;
      let teamWasModified = false;

      if (data.mode === 'bind') {
        if (!data.memberSlug) {
          flash.className = 'err-flash'; flash.textContent = '请选择要绑定的 Team 成员'; return;
        }
        memberSlug = data.memberSlug;
      } else {
        memberSlug = data.newSlug || autoSlug();
        if (!/^[a-z0-9-]+$/.test(memberSlug)) {
          flash.className = 'err-flash'; flash.textContent = 'slug 只能用 a-z, 0-9, - '; return;
        }
        if (team.some(m => m.slug === memberSlug)) {
          flash.className = 'err-flash'; flash.textContent = `slug "${memberSlug}" 已存在，请改 slug 或选"绑定"模式`; return;
        }
        const newMember = {
          slug: memberSlug, role: data.role,
          name:  { zh: data.nameZh || '', en: data.nameEn || '' },
          title: { zh: '', en: '' },
          affil: { zh: '', en: '' },
          email: '', photo: '',
          about: { zh: [], en: [] },
          education: [], experience: [], projects: [], publications: [], awards: [],
          social: { scholar: '', orcid: '', researchgate: '', github: '' }
        };
        try {
          await api('PUT', '/api/data/team', [...team, newMember]);
          teamWasModified = true;
        } catch (e) {
          flash.className = 'err-flash'; flash.textContent = '添加 Team 成员失败：' + e.message; return;
        }
      }

      /* Create the user account. If this fails, roll back the Team add. */
      try {
        await api('PUT', '/api/users/' + encodeURIComponent(data.username), {
          role: 'member', memberSlug, password: data.password
        });
        close();
        await renderUsersTab(main);
      } catch (e) {
        flash.className = 'err-flash';
        flash.textContent = '账号创建失败：' + e.message
          + (teamWasModified ? '。已回滚 Team 修改。' : '');
        if (teamWasModified) { await api('PUT', '/api/data/team', team).catch(() => {}); }
      }
    }
  }

  function openEditUserDialog(main, existing, team) {
    const data = { ...existing, password: '' };

    const passwordInput = el('input', {
      class: 'form-input', type: 'text', value: '',
      placeholder: '留空＝不修改密码',
      oninput: (e) => data.password = e.target.value
    });
    const memberSelect = el('select', {class: 'form-select',
      disabled: data.role === 'admin' ? 'disabled' : null,
      onchange: (e) => data.memberSlug = e.target.value });
    memberSelect.appendChild(el('option', {value: ''}, '— 不绑定 —'));
    for (const m of team) {
      const o = el('option', {value: m.slug}, `${m.slug}  (${m.role})`);
      if (data.memberSlug === m.slug) o.setAttribute('selected', '');
      memberSelect.appendChild(o);
    }

    const flash = el('div');
    const dialog = el('div', {class: 'dialog-backdrop',
      onclick: (e) => { if (e.target.classList.contains('dialog-backdrop')) close(); }},
      el('div', {class: 'dialog-box'},
        el('h3', null, `编辑账号：${existing.username}`),
        el('p', {class: 'muted', style: 'font-size: 13px; margin: 0 0 8px;'},
          '账号名和角色不可改。要改角色请先删账号再新建。'),
        formRow('密码', passwordInput, '留空表示不改密码。'),
        data.role === 'member' ? formRow('绑定成员', memberSelect,
          '改 memberSlug 会让该用户编辑另一条 Team 卡。') : null,
        flash,
        el('div', {class: 'dialog-actions'},
          el('button', {class: 'btn-ghost', onclick: close}, '取消'),
          el('button', {class: 'btn-primary', onclick: save}, '保存')
        )
      )
    );
    document.body.appendChild(dialog);

    function close() { dialog.remove(); }

    async function save() {
      flash.className = ''; flash.textContent = '';
      const body = { role: data.role };
      if (data.role === 'member') body.memberSlug = data.memberSlug || existing.memberSlug;
      if (data.password) {
        if (data.password.length < 6) { flash.className = 'err-flash'; flash.textContent = '密码至少 6 位'; return; }
        body.password = data.password;
      }
      try {
        await api('PUT', '/api/users/' + encodeURIComponent(existing.username), body);
        close();
        await renderUsersTab(main);
      } catch (e) {
        flash.className = 'err-flash'; flash.textContent = '保存失败：' + e.message;
      }
    }
  }

  /* ============================================================
     Run
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
