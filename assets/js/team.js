/**
 * Team renderer.
 *   renderTeamRoster() — fills .team-grid[data-role=...] sections on team.html
 *   renderTeamPerson() — reads ?slug=, projects bilingual data into the
 *                        globals expected by render.js, then triggers renders.
 */
(function () {
  function isEn() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('en');
  }

  /* Pick the language from a string-or-{zh,en} value. */
  function L(v, fallback) {
    if (v == null) return fallback != null ? fallback : '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      const en = isEn();
      return en ? (v.en || v.zh || '') : (v.zh || v.en || '');
    }
    return String(v);
  }

  /* Walk an array of strings or {zh,en} → array of strings. */
  function Larr(a) {
    if (!a) return [];
    if (typeof a === 'object' && !Array.isArray(a) && (a.zh || a.en)) {
      return isEn() ? (a.en || a.zh || []) : (a.zh || a.en || []);
    }
    return (a || []).map(function (x) { return L(x); });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
  }

  function getMember(slug) {
    if (!Array.isArray(window.__TEAM__)) return null;
    for (var i = 0; i < window.__TEAM__.length; i++) {
      if (window.__TEAM__[i].slug === slug) return window.__TEAM__[i];
    }
    return null;
  }

  /* ============================================================
     Team page meta (heading + subtitle), editable from admin
     ============================================================ */
  function renderTeamMeta() {
    const m = window.__TEAM_META__;
    if (!m) return;
    const titleEl = document.querySelector('#team-page-title');
    if (titleEl && m.title) {
      const t = L(m.title);
      if (t) titleEl.textContent = t;
    }
    const leadEl = document.querySelector('#team-page-lead');
    if (leadEl && m.lead) {
      const ld = L(m.lead);
      if (ld) leadEl.textContent = ld;
    }
  }
  window.renderTeamMeta = renderTeamMeta;

  /* ============================================================
     Roster rendering (team.html / team_en.html)
     ============================================================ */
  function renderTeamRoster() {
    var roles = ['copi', 'phd', 'master', 'ug'];
    var en = isEn();
    var personPage = en ? './team-person_en.html' : './team-person.html';

    roles.forEach(function (role) {
      var grid = document.querySelector('.team-grid[data-role="' + role + '"]');
      if (!grid) return;
      var members = (window.__TEAM__ || []).filter(function (m) { return m.role === role; });
      if (!members.length) {
        grid.innerHTML = '<p class="team-empty">' + (en ? '— vacancy —' : '— 暂无成员 —') + '</p>';
        return;
      }
      grid.innerHTML = members.map(function (m) {
        var name = L(m.name);
        var title = L(m.title);
        var photoHtml = m.photo
          ? '<img src="' + escapeHtml(m.photo) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
          : '<div class="team-card-placeholder">' + escapeHtml((name || '?').slice(0, 1)) + '</div>';
        var href = personPage + '?slug=' + encodeURIComponent(m.slug);
        return [
          '<a class="team-card" href="' + href + '">',
            '<div class="team-card-photo">', photoHtml, '</div>',
            '<h3 class="team-card-name">', escapeHtml(name), '</h3>',
            title ? '<p class="team-card-title">' + escapeHtml(title) + '</p>' : '',
          '</a>'
        ].join('');
      }).join('');
    });
  }

  /* ============================================================
     Per-person rendering (team-person.html / team-person_en.html)
     ============================================================ */
  function renderTeamPerson() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');
    var en = isEn();
    var rosterPage = en ? './team_en.html' : './team.html';

    if (!slug) {
      showError(en ? 'Missing slug parameter.' : '缺少 slug 参数。', rosterPage, en);
      return;
    }
    var m = getMember(slug);
    if (!m) {
      showError((en ? 'Member not found: ' : '找不到成员：') + slug, rosterPage, en);
      return;
    }

    /* Apply role color theme to the whole page */
    var role = m.role || 'copi';
    document.body.classList.add('role-' + role);

    /* Page title */
    document.title = L(m.name) + (en ? ' — UroExplorer' : ' · UroExplorer');

    /* Sidebar */
    setText('#person-name', L(m.name));
    setText('#person-title', L(m.title));
    setText('#person-affil', L(m.affil));
    setText('#person-email', m.email || '');

    var photoEl = document.querySelector('#person-photo');
    if (photoEl) {
      if (m.photo) {
        photoEl.src = m.photo;
        photoEl.alt = L(m.name);
      } else {
        var wrap = photoEl.closest('.image.avatar') || photoEl.parentElement;
        if (wrap) {
          wrap.outerHTML = '<div class="avatar-placeholder">' + escapeHtml((L(m.name) || '?').slice(0, 1)) + '</div>';
        }
      }
    }

    /* Email link wrapping */
    var emailEl = document.querySelector('#person-email');
    if (emailEl && m.email) {
      emailEl.innerHTML = '<a href="mailto:' + escapeHtml(m.email) + '">' + escapeHtml(m.email) + '</a>';
    }

    /* Social icons */
    var socialEl = document.querySelector('#person-socials');
    if (socialEl) {
      var items = [];
      if (m.email) items.push({ href: 'mailto:' + m.email, icon: 'fa-solid fa-envelope', title: 'Email' });
      var s = m.social || {};
      if (s.scholar)      items.push({ href: s.scholar,      icon: 'ai ai-google-scholar',  title: 'Google Scholar' });
      if (s.orcid)        items.push({ href: s.orcid,        icon: 'fa-brands fa-orcid',    title: 'ORCID' });
      if (s.researchgate) items.push({ href: s.researchgate, icon: 'fa-brands fa-researchgate', title: 'ResearchGate' });
      if (s.github)       items.push({ href: s.github,       icon: 'fa-brands fa-github',   title: 'GitHub' });
      socialEl.innerHTML = items.map(function (it) {
        return '<a href="' + escapeHtml(it.href) + '" target="_blank" rel="noopener" title="' + it.title + '"><i class="' + it.icon + '"></i></a>';
      }).join('');
    }

    /* Project bilingual member data into the globals render.js reads. */
    window.__ABOUT__ = Larr(m.about);

    window.__EDUCATION__ = (m.education || []).map(function (e) {
      return {
        institution: L(e.institution),
        logo:        e.logo || '',
        logoStyle:   e.logoStyle || '',
        levels: (e.levels || []).map(function (lv) {
          return { degree: L(lv.degree), field: L(lv.field), period: lv.period || '' };
        })
      };
    });

    window.__EXPERIENCE__ = (m.experience || []).map(function (g) {
      return {
        logo:      g.logo || '',
        logoStyle: g.logoStyle || '',
        alt:       L(g.alt),
        roles: (g.roles || []).map(function (r) {
          return { detail: L(r.detail), period: r.period || '' };
        })
      };
    });

    window.__PROJECTS__ = (m.projects || []).map(function (p) {
      return {
        title:       L(p.title),
        description: L(p.description),
        period:      p.period || '',
        status:      L(p.status)
      };
    });

    window.__PUBS__ = (m.publications || []).map(function (p) {
      var out = {};
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
      out.title   = L(p.title);
      out.authors = L(p.authors);
      out.journal = L(p.journal);
      return out;
    });

    window.__AWARDS__ = (m.awards || []).map(function (a) {
      return { year: a.year, text: L(a.text) };
    });

    /* Trigger renders (render.js exposed these globals) */
    if (window.renderAbout)      window.renderAbout('#about-body');
    if (window.renderEducation)  window.renderEducation('#edu-body');
    if (window.renderExperience) window.renderExperience('#exp-list');
    if (window.renderProjects)   window.renderProjects('#projects-body');
    if (window.renderPubs)       window.renderPubs('#pub-list');
    if (window.renderAwards)     window.renderAwards('#awards-body');

    /* Hide any section whose body ended up empty so the page doesn't show
       lonely headers. */
    ['#about-body', '#edu-body', '#exp-list', '#projects-body', '#pub-list', '#awards-body'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      if (!el.children.length && !el.textContent.trim()) {
        var sec = el.closest('.section');
        if (sec) sec.style.display = 'none';
      }
    });
  }

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text || '';
  }

  function showError(msg, rosterHref, en) {
    var content = document.querySelector('.content') || document.querySelector('main') || document.body;
    content.innerHTML = '<div class="subpage"><div class="panel muted" style="text-align:center;">' +
      escapeHtml(msg) +
      '<br><br><a href="' + escapeHtml(rosterHref) + '">' + (en ? '← UroExplorer' : '← UroExplorer') + '</a>' +
    '</div></div>';
  }

  window.renderTeamRoster = renderTeamRoster;
  window.renderTeamPerson = renderTeamPerson;
})();
