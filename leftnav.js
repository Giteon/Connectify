/**
 * Shared leftnav helpers. Currently: render the Projects tree from
 * cfg.customProjects (forked or user-created). Source of truth so the
 * tree stays consistent across editing-mode, view-mode, and graphs-hub.
 */
(function (global) {
  'use strict';

  function readJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readCustomProjects() {
    const rows = readJSON('cfg.customProjects', []);
    return Array.isArray(rows) ? rows : [];
  }

  function escHTML(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function projectTitleFor(row) {
    if (!row) return 'Untitled project';
    const t = (row.title || (row.project && row.project.title) || '').trim();
    return t || 'Untitled project';
  }

  /**
   * Render the leftnav projects tree into #lpTree. Marks the row whose
   * slug matches `currentSlug` as active. If a row is active it ALSO
   * updates #lpCurrentProjectName (so the in-app rename hook keeps working).
   * @param {string} [currentSlug] slug of the project currently being viewed/edited
   * @param {object} [opts]
   * @param {string} [opts.editHref='editing-mode-new.html'] base path for clicks
   */
  function renderProjects(currentSlug, opts) {
    opts = opts || {};
    const editHref = opts.editHref || 'editing-mode-new.html';
    const tree = document.getElementById('lpTree');
    if (!tree) return;

    const rawRows = readCustomProjects();
    // Dedupe: keep one entry per slug (shouldn't happen, but safety) AND one
    // entry per forkedFrom source (so re-forks don't pile up). The first row
    // wins — fork-project.js unshifts new forks to the top.
    const seenSlugs = new Set();
    const seenForkSources = new Set();
    const rows = [];
    for (const row of rawRows) {
      if (!row || !row.slug || seenSlugs.has(row.slug)) continue;
      if (row.forkedFrom && seenForkSources.has(row.forkedFrom)) continue;
      seenSlugs.add(row.slug);
      if (row.forkedFrom) seenForkSources.add(row.forkedFrom);
      rows.push(row);
    }
    if (!rows.length) {
      tree.innerHTML = '';
      return;
    }

    tree.innerHTML = rows.map((row) => {
      const slug = row && row.slug ? row.slug : '';
      if (!slug) return '';
      const title = projectTitleFor(row);
      const isActive = currentSlug && slug === currentSlug;
      const href = `${editHref}?project=${encodeURIComponent(slug)}`;
      return `<a class="lp-node${isActive ? ' active' : ''}" href="${escHTML(href)}" data-project="${escHTML(slug)}"${isActive ? ' aria-current="page"' : ''}>
        <span class="lp-node-label"${isActive ? ' id="lpCurrentProjectName"' : ''}>${escHTML(title)}</span>
      </a>`;
    }).join('');

    // When the list overflows (7+ rows), add a class that paints the
    // bottom-fade mask. The half-visible row tells the user "scroll for more".
    tree.classList.toggle('is-scrollable', rows.length > 6);
  }

  // ── Credits modal ─────────────────────────────────────────────
  // Centered overlay shown when the user clicks the credits chip. For
  // guests we hard-code 100 credits / 100% bar; backend wiring later.
  const CREDITS_STYLE_ID = 'connectify-credits-modal-style';
  function _ensureCreditsStyle() {
    if (document.getElementById(CREDITS_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CREDITS_STYLE_ID;
    style.textContent = `
      .cm-backdrop {
        position: fixed; inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 99000;
        display: none; align-items: center; justify-content: center;
        opacity: 0; transition: opacity .12s ease;
      }
      .cm-backdrop.open { display: flex; opacity: 1; }
      .cm-card {
        background: var(--surface, #fff);
        color: var(--text-primary);
        border: 1px solid var(--border);
        border-radius: 12px;
        width: min(440px, calc(100vw - 32px));
        max-height: calc(100vh - 64px);
        overflow-y: auto;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.25);
        font: inherit;
      }
      .cm-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 18px;
        border-bottom: 1px solid var(--border);
      }
      .cm-title { font-size: 15px; font-weight: 600; }
      .cm-close {
        width: 28px; height: 28px;
        display: inline-flex; align-items: center; justify-content: center;
        border: none; background: transparent; cursor: pointer;
        color: var(--text-muted); border-radius: 6px;
      }
      .cm-close:hover { background: var(--bg); color: var(--text-primary); }
      .cm-close svg { width: 14px; height: 14px; }
      .cm-body { padding: 18px; }
      .cm-value {
        font-size: 28px; font-weight: 700; color: var(--text-primary);
        line-height: 1.1;
      }
      .cm-bar {
        margin-top: 12px;
        width: 100%; height: 8px; background: var(--border); border-radius: 4px;
        overflow: hidden;
      }
      .cm-bar-fill {
        display: block; height: 100%; background: var(--primary);
        transition: width .25s ease;
      }
      .cm-stats {
        margin-top: 18px;
        display: grid; grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
      }
      .cm-stat { display: flex; flex-direction: column; gap: 4px; }
      .cm-stat-label {
        font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
        text-transform: uppercase; color: var(--text-muted);
      }
      .cm-stat-value { font-size: 13px; font-weight: 600; color: var(--text-primary); }
      .cm-section {
        margin-top: 20px;
        padding-top: 16px; border-top: 1px solid var(--border);
      }
      .cm-section-title {
        font-size: 13px; font-weight: 600; color: var(--text-primary);
        margin-bottom: 10px;
      }
      .cm-usage-empty {
        padding: 24px 12px;
        text-align: center;
        font-size: 12.5px; color: var(--text-muted);
        background: var(--bg);
        border: 1px dashed var(--border);
        border-radius: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function _formatResetDate() {
    // First day of next month — placeholder reset window.
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function showCreditsModal(opts) {
    opts = opts || {};
    const remaining = opts.remaining != null ? opts.remaining : 100;
    const cap = opts.cap != null ? opts.cap : 100;
    const pct = cap > 0 ? Math.max(0, Math.min(100, (remaining / cap) * 100)) : 0;
    const resetLabel = opts.resetLabel || _formatResetDate();

    _ensureCreditsStyle();
    document.querySelectorAll('.cm-backdrop').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'cm-backdrop';
    backdrop.innerHTML = `
      <div class="cm-card" role="dialog" aria-modal="true" aria-label="Credits">
        <div class="cm-head">
          <div class="cm-title">Credits</div>
          <button type="button" class="cm-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="cm-body">
          <div class="cm-value">${remaining} credits</div>
          <div class="cm-bar"><span class="cm-bar-fill" style="width:${pct}%"></span></div>
          <div class="cm-stats">
            <div class="cm-stat">
              <span class="cm-stat-label">Remaining</span>
              <span class="cm-stat-value">${remaining}</span>
            </div>
            <div class="cm-stat">
              <span class="cm-stat-label">Monthly cap</span>
              <span class="cm-stat-value">${cap}</span>
            </div>
            <div class="cm-stat">
              <span class="cm-stat-label">Resets</span>
              <span class="cm-stat-value">${escHTML(resetLabel)}</span>
            </div>
          </div>
          <div class="cm-section">
            <div class="cm-section-title">Usage breakdown</div>
            <div class="cm-usage-empty">No usage yet this period.</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));

    const close = () => {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 150);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    backdrop.querySelector('.cm-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);
  }

  // ── Collapsable sections (Projects, My Teams) ─────────────────
  // Persists open/closed state to localStorage so it survives page nav.
  // Defaults (when no stored state): projects expanded.
  const COLLAPSE_KEY_PREFIX = 'cfg.leftnav.collapsable.';
  const COLLAPSE_DEFAULTS = {
    leftnavProjects: true,
  };
  function _readCollapseState(wrapId) {
    try {
      const v = localStorage.getItem(COLLAPSE_KEY_PREFIX + wrapId);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch (_) { /* storage */ }
    return COLLAPSE_DEFAULTS[wrapId] != null ? COLLAPSE_DEFAULTS[wrapId] : true;
  }
  function _writeCollapseState(wrapId, expanded) {
    try { localStorage.setItem(COLLAPSE_KEY_PREFIX + wrapId, expanded ? '1' : '0'); } catch (_) {}
  }
  function wireCollapsable(wrapId, toggleId) {
    const wrap = document.getElementById(wrapId);
    const toggle = document.getElementById(toggleId);
    if (!wrap || !toggle) return;
    // Restore saved state on init.
    const initialExpanded = _readCollapseState(wrapId);
    wrap.dataset.expanded = initialExpanded ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', String(initialExpanded));
    toggle.addEventListener('click', () => {
      const expanded = wrap.dataset.expanded === 'true';
      const next = !expanded;
      wrap.dataset.expanded = next ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', String(next));
      _writeCollapseState(wrapId, next);
    });
  }

  global.ConnectifyLeftnav = {
    renderProjects,
    readCustomProjects,
    showCreditsModal,
    wireCollapsable,
  };
})(window);
