/**
 * Command palette (⌘K / Ctrl+K). Shared across editing-mode, graphs-hub, and
 * view-mode. A centered overlay with fuzzy search over registered "providers".
 *
 * Architecture: the core owns the overlay, fuzzy matching, grouped rendering,
 * and keyboard navigation. Each page contributes results by registering a
 * provider — a function that returns items fresh on every open, so node lists
 * and project lists stay current.
 *
 *   CommandPalette.register({
 *     id: 'editor-nodes',
 *     getItems() {
 *       return [{ group: 'Nodes', title, subtitle, icon, keywords, run }];
 *     }
 *   });
 *
 * The core self-registers the providers that work everywhere (Projects,
 * Navigation, Theme) using ConnectifyLeftnav helpers. The ⌘K affordance in the
 * leftnav already dispatches a synthetic ⌘K keydown, which this module's global
 * listener catches — so no per-page wiring is needed to open it.
 */
(function (global) {
  'use strict';

  const STYLE_ID = 'connectify-cmdk-style';
  // Fixed order for the empty state and ties. When searching, groups are
  // re-sorted by their best-matching item so the most relevant group floats up.
  const GROUP_ORDER = ['Actions', 'Nodes', 'Projects', 'Navigate'];
  const EMPTY_STATE_CAP = 5; // max items per group shown before the user types

  const providers = [];
  let overlay = null;
  let inputEl = null;
  let listEl = null;
  let flatItems = []; // currently rendered, selectable items in display order
  let activeIndex = 0;
  let isOpen = false;
  let lastFocused = null;

  function escHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ── Fuzzy matcher ─────────────────────────────────────────────
  // Subsequence match with scoring: rewards consecutive runs and matches at the
  // start of a word/string. Returns { matched, score, ranges } where ranges are
  // [start, end) index pairs into `text` for highlighting.
  function fuzzy(query, text) {
    if (!query) return { matched: true, score: 0, ranges: [] };
    const q = query.toLowerCase();
    const t = String(text || '');
    const tl = t.toLowerCase();
    let qi = 0;
    let score = 0;
    let runLen = 0;
    const ranges = [];
    let rangeStart = -1;
    for (let ti = 0; ti < tl.length && qi < q.length; ti++) {
      if (tl[ti] === q[qi]) {
        // Bonus for start-of-string or start-of-word (after a separator).
        const prev = ti > 0 ? tl[ti - 1] : ' ';
        const isBoundary = ti === 0 || /[\s\-_/.]/.test(prev);
        score += 1 + (isBoundary ? 3 : 0) + runLen * 2;
        runLen++;
        if (rangeStart === -1) rangeStart = ti;
        qi++;
      } else {
        runLen = 0;
        if (rangeStart !== -1) { ranges.push([rangeStart, ti]); rangeStart = -1; }
      }
    }
    if (rangeStart !== -1) ranges.push([rangeStart, rangeStart + runLen]);
    if (qi < q.length) return { matched: false, score: 0, ranges: [] };
    // Prefer shorter, tighter matches.
    score -= t.length * 0.05;
    return { matched: true, score, ranges };
  }

  function highlight(text, ranges) {
    const t = String(text || '');
    if (!ranges || !ranges.length) return escHTML(t);
    let out = '';
    let cursor = 0;
    for (const [s, e] of ranges) {
      out += escHTML(t.slice(cursor, s));
      out += '<mark>' + escHTML(t.slice(s, e)) + '</mark>';
      cursor = e;
    }
    out += escHTML(t.slice(cursor));
    return out;
  }

  // ── Providers ─────────────────────────────────────────────────
  function register(provider) {
    if (!provider || !provider.id || typeof provider.getItems !== 'function') return;
    const existing = providers.findIndex(p => p.id === provider.id);
    if (existing !== -1) providers[existing] = provider;
    else providers.push(provider);
  }
  function unregister(id) {
    const i = providers.findIndex(p => p.id === id);
    if (i !== -1) providers.splice(i, 1);
  }

  function collectItems() {
    const out = [];
    for (const p of providers) {
      let got;
      try { got = p.getItems() || []; } catch (_) { got = []; }
      for (const it of got) if (it && it.title) out.push(it);
    }
    return out;
  }

  // ── Styles ────────────────────────────────────────────────────
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .cmdk-backdrop {
        position: fixed; inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 99500;
        display: none;
        align-items: flex-start; justify-content: center;
        padding-top: 14vh;
        opacity: 0; transition: opacity .12s ease;
      }
      .cmdk-backdrop.open { display: flex; opacity: 1; }
      .cmdk-panel {
        background: var(--surface, #fff);
        color: var(--text-primary, #0f172a);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 14px;
        width: min(640px, calc(100vw - 32px));
        max-height: 70vh;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.32);
        transform: translateY(-6px) scale(.99);
        transition: transform .12s ease;
      }
      .cmdk-backdrop.open .cmdk-panel { transform: none; }
      .cmdk-input-row {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border, #e2e8f0);
      }
      .cmdk-input-row svg { width: 18px; height: 18px; color: var(--text-muted, #64748b); flex: none; }
      .cmdk-input {
        flex: 1; border: none; outline: none; background: transparent;
        font: inherit; font-size: 16px; color: var(--text-primary, #0f172a);
      }
      .cmdk-input::placeholder { color: var(--text-muted, #94a3b8); }
      .cmdk-hint {
        font-size: 11px; color: var(--text-muted, #94a3b8);
        border: 1px solid var(--border, #e2e8f0); border-radius: 5px;
        padding: 2px 6px; flex: none;
      }
      .cmdk-list { overflow-y: auto; padding: 6px; }
      .cmdk-group-label {
        font-size: 10.5px; font-weight: 600; letter-spacing: .07em;
        text-transform: uppercase; color: var(--text-muted, #94a3b8);
        padding: 10px 10px 4px;
      }
      .cmdk-item {
        display: flex; align-items: center; gap: 11px;
        padding: 9px 10px; border-radius: 8px; cursor: pointer;
        user-select: none;
      }
      .cmdk-item.active { background: var(--primary-soft, rgba(99, 102, 241, .12)); }
      .cmdk-item-icon {
        width: 28px; height: 28px; flex: none;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 7px;
        background: var(--bg, #f1f5f9); color: var(--text-muted, #64748b);
      }
      .cmdk-item-icon svg { width: 15px; height: 15px; }
      .cmdk-item-icon .cmdk-swatch { width: 12px; height: 12px; border-radius: 3px; }
      .cmdk-item-text { flex: 1; min-width: 0; }
      .cmdk-item-title {
        font-size: 13.5px; color: var(--text-primary, #0f172a);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cmdk-item-title mark { background: transparent; color: var(--primary, #6366f1); font-weight: 600; }
      .cmdk-item-sub {
        font-size: 11.5px; color: var(--text-muted, #94a3b8);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cmdk-item-tag {
        font-size: 10.5px; color: var(--text-muted, #94a3b8);
        border: 1px solid var(--border, #e2e8f0); border-radius: 5px;
        padding: 2px 7px; flex: none;
      }
      .cmdk-empty {
        padding: 36px 16px; text-align: center;
        font-size: 13px; color: var(--text-muted, #94a3b8);
      }
    `;
    document.head.appendChild(style);
  }

  // ── DOM ───────────────────────────────────────────────────────
  const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';

  function ensureDom() {
    if (overlay) return;
    ensureStyle();
    overlay = document.createElement('div');
    overlay.className = 'cmdk-backdrop';
    overlay.innerHTML = `
      <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="cmdk-input-row">
          ${SEARCH_ICON}
          <input type="text" class="cmdk-input" placeholder="Search nodes, projects, actions…"
                 autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                 aria-label="Search" aria-controls="cmdkList" />
          <span class="cmdk-hint">Esc</span>
        </div>
        <div class="cmdk-list" id="cmdkList" role="listbox"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    inputEl = overlay.querySelector('.cmdk-input');
    listEl = overlay.querySelector('.cmdk-list');

    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    inputEl.addEventListener('input', () => render(inputEl.value));
    listEl.addEventListener('mousemove', (e) => {
      const row = e.target.closest('.cmdk-item');
      if (!row) return;
      const idx = Number(row.dataset.index);
      if (!Number.isNaN(idx) && idx !== activeIndex) setActive(idx);
    });
    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.cmdk-item');
      if (!row) return;
      const idx = Number(row.dataset.index);
      if (!Number.isNaN(idx)) runItem(idx);
    });
  }

  // ── Rendering ─────────────────────────────────────────────────
  function render(query) {
    const q = (query || '').trim();
    const all = collectItems();
    const byGroup = new Map();

    if (!q) {
      // Empty state: fixed group order, capped per group.
      for (const it of all) {
        const g = it.group || 'Actions';
        if (!byGroup.has(g)) byGroup.set(g, []);
        const arr = byGroup.get(g);
        if (arr.length < EMPTY_STATE_CAP) arr.push({ item: it, ranges: [] });
      }
    } else {
      for (const it of all) {
        const hayList = [it.title, it.subtitle, ...(it.keywords || [])].filter(Boolean);
        let best = { matched: false, score: -Infinity, ranges: [] };
        // Score against the title for highlight ranges; let subtitle/keywords
        // contribute to matching (with a small penalty so title wins ties).
        const titleMatch = fuzzy(q, it.title);
        if (titleMatch.matched) best = { matched: true, score: titleMatch.score, ranges: titleMatch.ranges };
        for (let i = 1; i < hayList.length; i++) {
          const m = fuzzy(q, hayList[i]);
          if (m.matched && m.score - 2 > best.score) best = { matched: true, score: m.score - 2, ranges: [] };
        }
        if (!best.matched) continue;
        const g = it.group || 'Actions';
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push({ item: it, ranges: best.ranges, score: best.score });
      }
      for (const arr of byGroup.values()) arr.sort((a, b) => b.score - a.score);
    }

    // Order groups: empty state uses GROUP_ORDER; search orders by best score.
    let groups = [...byGroup.keys()];
    if (!q) {
      groups.sort((a, b) => {
        const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    } else {
      groups.sort((a, b) => {
        const sa = byGroup.get(a)[0]?.score ?? -Infinity;
        const sb = byGroup.get(b)[0]?.score ?? -Infinity;
        if (sb !== sa) return sb - sa;
        const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    }

    flatItems = [];
    let html = '';
    for (const g of groups) {
      const rows = byGroup.get(g);
      if (!rows.length) continue;
      html += `<div class="cmdk-group-label">${escHTML(g)}</div>`;
      for (const { item, ranges } of rows) {
        const idx = flatItems.length;
        flatItems.push(item);
        html += renderItem(item, ranges, idx);
      }
    }

    if (!flatItems.length) {
      listEl.innerHTML = `<div class="cmdk-empty">No results for “${escHTML(q)}”</div>`;
      activeIndex = -1;
      return;
    }
    listEl.innerHTML = html;
    setActive(0);
  }

  function renderItem(item, ranges, idx) {
    let iconHtml = '';
    if (item.swatch) iconHtml = `<span class="cmdk-item-icon"><span class="cmdk-swatch" style="background:${escHTML(item.swatch)}"></span></span>`;
    else if (item.icon) iconHtml = `<span class="cmdk-item-icon">${item.icon}</span>`;
    else iconHtml = `<span class="cmdk-item-icon">${SEARCH_ICON}</span>`;
    const sub = item.subtitle ? `<div class="cmdk-item-sub">${escHTML(item.subtitle)}</div>` : '';
    const tag = item.tag ? `<span class="cmdk-item-tag">${escHTML(item.tag)}</span>` : '';
    return `
      <div class="cmdk-item" role="option" data-index="${idx}">
        ${iconHtml}
        <div class="cmdk-item-text">
          <div class="cmdk-item-title">${highlight(item.title, ranges)}</div>
          ${sub}
        </div>
        ${tag}
      </div>`;
  }

  function setActive(idx) {
    activeIndex = idx;
    const rows = listEl.querySelectorAll('.cmdk-item');
    rows.forEach((r, i) => {
      const on = i === idx;
      r.classList.toggle('active', on);
      r.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) r.scrollIntoView({ block: 'nearest' });
    });
  }

  function move(delta) {
    if (!flatItems.length) return;
    let next = activeIndex + delta;
    if (next < 0) next = flatItems.length - 1;
    if (next >= flatItems.length) next = 0;
    setActive(next);
  }

  function runItem(idx) {
    const item = flatItems[idx];
    if (!item || typeof item.run !== 'function') return;
    close();
    // Defer so the overlay is gone before the action mutates the page.
    setTimeout(() => { try { item.run(); } catch (e) { console.error('[cmdk] run failed', e); } }, 0);
  }

  // ── Open / close ──────────────────────────────────────────────
  function open() {
    ensureDom();
    if (isOpen) { inputEl.focus(); inputEl.select(); return; }
    isOpen = true;
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    inputEl.value = '';
    render('');
    requestAnimationFrame(() => inputEl.focus());
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('open');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (_) {}
    }
    lastFocused = null;
  }

  function toggle() { isOpen ? close() : open(); }

  // ── Global keyboard ───────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    const isToggle = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey;
    if (isToggle) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) runItem(activeIndex); }
  }, true);

  // ── Shared providers (work on every page) ─────────────────────
  const ICONS = {
    project: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  function gotoProject(slug) {
    const L = global.ConnectifyLeftnav;
    if (L && typeof L.rememberProjectNav === 'function') L.rememberProjectNav(slug);
    window.location.href = 'editing-mode-new.html?project=' + encodeURIComponent(slug);
  }

  register({
    id: 'shared-projects',
    getItems() {
      const L = global.ConnectifyLeftnav;
      if (!L || typeof L.readCustomProjects !== 'function') return [];
      const current = (typeof L.resolveProjectSlug === 'function') ? L.resolveProjectSlug() : null;
      const seen = new Set();
      const rows = [];
      for (const row of L.readCustomProjects()) {
        if (!row || !row.slug || seen.has(row.slug)) continue;
        seen.add(row.slug);
        const title = (row.title || (row.project && row.project.title) || '').trim() || 'Untitled project';
        rows.push({
          group: 'Projects',
          title,
          subtitle: row.slug === current ? 'Current project' : 'Open project',
          icon: ICONS.project,
          keywords: ['project', 'open', 'graph', row.slug],
          run: () => { if (row.slug !== current) gotoProject(row.slug); else close(); }
        });
      }
      return rows;
    }
  });

  register({
    id: 'shared-navigation',
    getItems() {
      const L = global.ConnectifyLeftnav;
      const go = (tab) => () => {
        if (L && typeof L.stashHubTab === 'function') L.stashHubTab(tab);
        window.location.href = 'graphs-hub.html?tab=' + tab;
      };
      const nav = [
        { tab: 'dashboard', title: 'Go to Dashboard', icon: ICONS.dashboard, keywords: ['home', 'hub', 'projects'] },
        { tab: 'community', title: 'Go to Community', icon: ICONS.nav, keywords: ['explore', 'public', 'graphs'] },
        { tab: 'my-team', title: 'Go to My Team', icon: ICONS.nav, keywords: ['team', 'members'] },
        { tab: 'settings', title: 'Go to Settings', icon: ICONS.nav, keywords: ['preferences', 'config'] }
      ];
      const items = nav.map(n => ({
        group: 'Navigate', title: n.title, icon: n.icon, keywords: n.keywords, run: go(n.tab)
      }));
      items.push({
        group: 'Navigate', title: 'New project', icon: ICONS.plus,
        keywords: ['create', 'add', 'project'],
        run: () => { window.location.href = 'graphs-hub.html?tab=dashboard&new=1'; }
      });
      return items;
    }
  });

  register({
    id: 'shared-theme',
    getItems() {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      return [{
        group: 'Actions',
        title: isDark ? 'Switch to light theme' : 'Switch to dark theme',
        icon: ICONS.theme,
        keywords: ['theme', 'dark', 'light', 'appearance', 'mode'],
        run: () => { document.querySelector('.theme-toggle')?.click(); }
      }];
    }
  });

  global.CommandPalette = { register, unregister, open, close, toggle, ICONS, escHTML };
})(window);
