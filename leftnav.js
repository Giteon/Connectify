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

  const NAV_HINT_KEY = 'cfg.navHint.project';
  const HUB_TAB_HINT_KEY = 'cfg.navHint.hubTab';
  const VALID_HUB_TABS = new Set(['dashboard', 'community', 'settings', 'my-team']);
  const LAST_EDITED_KEY = 'cfg.lastEditedSlug';
  const TUTORIAL_STATE_KEY = 'cfg.tutorialState';

  /** Stash slug before navigation so a clean-URL redirect can recover it. */
  function stashNavHint(slug) {
    if (!slug) return;
    try { sessionStorage.setItem(NAV_HINT_KEY, slug); } catch (_) {}
  }

  function parseHubTabFromHref(href) {
    if (!href || !/graphs-hub/i.test(href)) return null;
    try {
      const tab = new URL(href, location.href).searchParams.get('tab');
      return tab && VALID_HUB_TABS.has(tab) ? tab : null;
    } catch (_) {
      const m = String(href).match(/[?&]tab=([^&]+)/);
      return m && VALID_HUB_TABS.has(m[1]) ? m[1] : null;
    }
  }

  /** Stash graphs-hub tab before navigation (clean-URL servers may drop ?tab=). */
  function stashHubTab(tab) {
    if (!tab || !VALID_HUB_TABS.has(tab)) return;
    try { sessionStorage.setItem(HUB_TAB_HINT_KEY, tab); } catch (_) {}
  }

  /** Resolve hub tab from URL, else one-shot sessionStorage hint. */
  function resolveHubTab(fallback) {
    const fb = fallback && VALID_HUB_TABS.has(fallback) ? fallback : 'dashboard';
    try {
      const fromQuery = new URLSearchParams(location.search).get('tab');
      if (fromQuery && VALID_HUB_TABS.has(fromQuery)) return fromQuery;
    } catch (_) {}
    try {
      const hint = sessionStorage.getItem(HUB_TAB_HINT_KEY);
      if (hint) {
        sessionStorage.removeItem(HUB_TAB_HINT_KEY);
        if (VALID_HUB_TABS.has(hint)) return hint;
      }
    } catch (_) {}
    return fb;
  }

  function wireHubTabLinksOnce() {
    if (document.documentElement.dataset.hubTabBound === '1') return;
    document.documentElement.dataset.hubTabBound = '1';
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="graphs-hub"]');
      if (!a) return;
      const tab = parseHubTabFromHref(a.getAttribute('href') || '');
      if (tab) stashHubTab(tab);
    }, true);
  }

  /** Remember the last opened project and tie it to an in-progress tour. */
  function rememberProjectNav(slug) {
    if (!slug) return;
    stashNavHint(slug);
    try { localStorage.setItem(LAST_EDITED_KEY, slug); } catch (_) {}
    try {
      const raw = localStorage.getItem(TUTORIAL_STATE_KEY);
      if (!raw) return;
      const ts = JSON.parse(raw);
      if (ts && ts.started && !ts.skipped && !ts.completed) {
        ts.projectSlug = slug;
        ts.lastActivity = Date.now();
        localStorage.setItem(TUTORIAL_STATE_KEY, JSON.stringify(ts));
      }
    } catch (_) {}
  }

  function findOnboardingForkSlug() {
    const hit = readCustomProjects().find(r => r && r.forkedFrom === 'onboarding-starter' && r.slug);
    return hit ? hit.slug : null;
  }

  function isTutorialActive() {
    try {
      const raw = localStorage.getItem(TUTORIAL_STATE_KEY);
      if (!raw) return true; // default-on for first-time users
      const ts = JSON.parse(raw);
      return !!(ts && ts.started && !ts.skipped && !ts.completed);
    } catch (_) {
      return false;
    }
  }

  /**
   * Resolve which project slug to load. Primary source is `?project=…`; falls
   * back to sessionStorage hint (one-shot), tutorial fork slug, then the last
   * edited custom project — covers static servers that strip query strings.
   */
  function resolveProjectSlug() {
    const fromQuery = new URLSearchParams(location.search).get('project');
    if (fromQuery) return fromQuery;
    try {
      const hint = sessionStorage.getItem(NAV_HINT_KEY);
      if (hint) {
        sessionStorage.removeItem(NAV_HINT_KEY);
        return hint;
      }
    } catch (_) {}
    if (isTutorialActive()) {
      try {
        const raw = localStorage.getItem(TUTORIAL_STATE_KEY);
        const ts = raw ? JSON.parse(raw) : null;
        if (ts && ts.projectSlug) return ts.projectSlug;
        if (ts && ts.currentStep >= 3) {
          const fork = findOnboardingForkSlug();
          if (fork) return fork;
        }
      } catch (_) {}
    }
    try {
      const last = localStorage.getItem(LAST_EDITED_KEY);
      if (last && readCustomProjects().some(r => r && r.slug === last)) return last;
    } catch (_) {}
    return null;
  }

  function wireProjectLinksOnce() {
    const tree = document.getElementById('lpTree');
    if (!tree || tree.dataset.navBound === '1') return;
    tree.dataset.navBound = '1';
    tree.addEventListener('click', (e) => {
      const a = e.target.closest('a.lp-node[data-project]');
      if (!a) return;
      rememberProjectNav(a.getAttribute('data-project'));
    });
  }

  function wireNavEditLinkOnce() {
    if (document.documentElement.dataset.navEditBound === '1') return;
    document.documentElement.dataset.navEditBound = '1';
    document.addEventListener('click', (e) => {
      const a = e.target.closest('#navEditLink');
      if (!a || !a.href) return;
      try {
        const s = new URL(a.href, location.href).searchParams.get('project');
        if (s) rememberProjectNav(s);
      } catch (_) {}
    }, true);
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
    wireProjectLinksOnce();

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
  // ── Credits store ─────────────────────────────────────────────
  // Single source of truth for the credit balance. localStorage-only
  // (no backend yet); both the leftnav badge and the credits modal
  // read/write through here so they never drift. `cap` is the high-
  // water mark used to scale the progress bar — it grows when a
  // purchase pushes the balance above the previous cap.
  const CREDITS_BALANCE_KEY = 'cfg.credits.balance';
  const CREDITS_CAP_KEY = 'cfg.credits.cap';
  const CREDITS_DEFAULT = 100;

  function getCreditsBalance() {
    const raw = parseInt(localStorage.getItem(CREDITS_BALANCE_KEY), 10);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return CREDITS_DEFAULT;
  }
  function getCreditsCap() {
    const raw = parseInt(localStorage.getItem(CREDITS_CAP_KEY), 10);
    const bal = getCreditsBalance();
    if (Number.isFinite(raw) && raw > 0) return Math.max(raw, bal);
    return Math.max(CREDITS_DEFAULT, bal);
  }
  function setCreditsBalance(n) {
    const val = Math.max(0, Math.round(n));
    try { localStorage.setItem(CREDITS_BALANCE_KEY, String(val)); } catch (_) {}
    // Cap only ever ratchets up so the bar reads as "topped up" right after
    // a buy, then drains as credits get spent. Read the *raw* stored cap here
    // (not getCreditsCap(), which folds in the balance and would make this
    // comparison never fire).
    const rawCap = parseInt(localStorage.getItem(CREDITS_CAP_KEY), 10);
    const storedCap = Number.isFinite(rawCap) && rawCap > 0 ? rawCap : CREDITS_DEFAULT;
    if (val > storedCap) {
      try { localStorage.setItem(CREDITS_CAP_KEY, String(val)); } catch (_) {}
    }
    syncCreditsBadge();
    return val;
  }
  function addCredits(n) {
    return setCreditsBalance(getCreditsBalance() + Math.max(0, Math.round(n)));
  }
  // Push the current balance into the leftnav badge wherever it exists.
  function syncCreditsBadge() {
    const bal = getCreditsBalance();
    const cap = getCreditsCap();
    const pct = cap > 0 ? Math.max(0, Math.min(100, (bal / cap) * 100)) : 0;
    const valEl = document.getElementById('leftnavCreditsValue');
    if (valEl) valEl.textContent = `${bal.toLocaleString()} credits`;
    const barEl = document.getElementById('leftnavCreditsBar');
    if (barEl) barEl.style.width = pct + '%';
    const btn = document.getElementById('leftnavCredits');
    if (btn) btn.dataset.credits = String(bal);
  }

  // Credit packages offered in the buy view. `bonus` is purely for
  // marketing copy ("Best value"); pricing is illustrative for the MVP.
  const CREDIT_PACKAGES = [
    { id: 'starter', credits: 500,  price: 10, label: 'Starter' },
    { id: 'pro',     credits: 1500, price: 25, label: 'Pro', badge: 'Best value' },
    { id: 'scale',   credits: 5000, price: 75, label: 'Scale' },
  ];

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
      /* Primary action — "Buy more credits" / package buttons. */
      .cm-buy-btn {
        margin-top: 18px;
        width: 100%;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 11px 14px;
        font: inherit; font-size: 14px; font-weight: 600;
        color: #fff; background: var(--primary);
        border: none; border-radius: 9px; cursor: pointer;
        transition: filter .12s ease;
      }
      .cm-buy-btn:hover { filter: brightness(1.06); }
      .cm-buy-btn svg { width: 15px; height: 15px; }
      /* Logged-out nudge banner in the buy view. */
      .cm-nudge {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 12px; margin-bottom: 16px;
        font-size: 12.5px; color: var(--text-secondary, var(--text-muted));
        background: var(--bg);
        border: 1px solid var(--border); border-radius: 8px;
      }
      .cm-nudge a { color: var(--primary); font-weight: 600; text-decoration: none; }
      .cm-nudge a:hover { text-decoration: underline; }
      .cm-nudge svg { width: 15px; height: 15px; flex-shrink: 0; color: var(--text-muted); }
      /* Package list. */
      .cm-pkgs { display: flex; flex-direction: column; gap: 10px; }
      .cm-pkg {
        position: relative;
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        text-align: left;
        font: inherit;
        background: var(--surface, #fff);
        border: 1px solid var(--border); border-radius: 10px;
        cursor: pointer;
        transition: border-color .12s ease, box-shadow .12s ease, transform .12s ease;
      }
      .cm-pkg:hover {
        border-color: var(--primary);
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.12);
      }
      .cm-pkg:active { transform: scale(0.99); }
      .cm-pkg--featured { border-color: var(--primary); }
      .cm-pkg-info { display: flex; flex-direction: column; gap: 3px; }
      .cm-pkg-credits { font-size: 16px; font-weight: 700; color: var(--text-primary); }
      .cm-pkg-label { font-size: 12px; color: var(--text-muted); }
      .cm-pkg-price {
        font-size: 16px; font-weight: 700; color: var(--text-primary);
        white-space: nowrap;
      }
      .cm-pkg-badge {
        position: absolute; top: -8px; right: 14px;
        font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #fff; background: var(--primary);
        padding: 3px 8px; border-radius: 999px;
      }
      .cm-back {
        display: inline-flex; align-items: center; gap: 5px;
        margin-bottom: 14px;
        font: inherit; font-size: 12.5px; font-weight: 600;
        color: var(--text-muted);
        background: none; border: none; cursor: pointer; padding: 0;
      }
      .cm-back:hover { color: var(--text-primary); }
      .cm-back svg { width: 13px; height: 13px; }
      .cm-fineprint {
        margin-top: 14px;
        font-size: 11px; line-height: 1.5; color: var(--text-muted);
        text-align: center;
      }
      /* Processing + success states. */
      .cm-state {
        display: flex; flex-direction: column; align-items: center;
        text-align: center; padding: 28px 12px;
      }
      .cm-spinner {
        width: 36px; height: 36px;
        border: 3px solid var(--border); border-top-color: var(--primary);
        border-radius: 50%;
        animation: cm-spin .7s linear infinite;
      }
      @keyframes cm-spin { to { transform: rotate(360deg); } }
      .cm-success-ico {
        width: 48px; height: 48px; border-radius: 50%;
        display: grid; place-items: center;
        background: rgba(34, 197, 94, 0.14); color: #16a34a;
        margin-bottom: 14px;
      }
      .cm-success-ico svg { width: 26px; height: 26px; }
      .cm-state-title { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
      .cm-state-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 4px; }
      .cm-state-balance { font-size: 13px; color: var(--text-primary); font-weight: 600; margin-top: 4px; }
      .cm-done-btn {
        margin-top: 20px; min-width: 140px;
        padding: 10px 18px;
        font: inherit; font-size: 14px; font-weight: 600;
        color: #fff; background: var(--primary);
        border: none; border-radius: 9px; cursor: pointer;
      }
      .cm-done-btn:hover { filter: brightness(1.06); }
    `;
    document.head.appendChild(style);
  }

  function _formatResetDate() {
    // First day of next month — placeholder reset window.
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Credits modal. Three swappable inner views rendered into the same
  // card body: 'balance' (default) → 'buy' (package picker) → 'success'.
  // `opts.view` lets callers deep-link straight into the buy flow (used
  // by the landing-page "Buy credits" CTA via ?credits=1).
  function showCreditsModal(opts) {
    opts = opts || {};
    const resetLabel = opts.resetLabel || _formatResetDate();

    _ensureCreditsStyle();
    document.querySelectorAll('.cm-backdrop').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'cm-backdrop';
    backdrop.innerHTML = `
      <div class="cm-card" role="dialog" aria-modal="true" aria-label="Credits">
        <div class="cm-head">
          <div class="cm-title" data-cm-title>Credits</div>
          <button type="button" class="cm-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="cm-body" data-cm-body></div>
      </div>
    `;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));

    const titleEl = backdrop.querySelector('[data-cm-title]');
    const bodyEl = backdrop.querySelector('[data-cm-body]');

    let locked = false; // true during the fake checkout so backdrop/Esc can't close
    const close = () => {
      if (locked) return;
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 150);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    backdrop.querySelector('.cm-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);

    // ── View renderers ───────────────────────────────────────────
    function renderBalance() {
      titleEl.textContent = 'Credits';
      const remaining = getCreditsBalance();
      const cap = getCreditsCap();
      const pct = cap > 0 ? Math.max(0, Math.min(100, (remaining / cap) * 100)) : 0;
      bodyEl.innerHTML = `
        <div class="cm-value">${remaining.toLocaleString()} credits</div>
        <div class="cm-bar"><span class="cm-bar-fill" style="width:${pct}%"></span></div>
        <div class="cm-stats">
          <div class="cm-stat">
            <span class="cm-stat-label">Remaining</span>
            <span class="cm-stat-value">${remaining.toLocaleString()}</span>
          </div>
          <div class="cm-stat">
            <span class="cm-stat-label">Cap</span>
            <span class="cm-stat-value">${cap.toLocaleString()}</span>
          </div>
          <div class="cm-stat">
            <span class="cm-stat-label">Resets</span>
            <span class="cm-stat-value">${escHTML(resetLabel)}</span>
          </div>
        </div>
        <button type="button" class="cm-buy-btn" data-cm-buy>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Buy more credits
        </button>
        <div class="cm-section">
          <div class="cm-section-title">Usage breakdown</div>
          <div class="cm-usage-empty">No usage yet this period.</div>
        </div>
      `;
      bodyEl.querySelector('[data-cm-buy]').addEventListener('click', renderBuy);
    }

    function renderBuy() {
      titleEl.textContent = 'Buy credits';
      const loggedIn = !!(global.ConnectifyAuth && global.ConnectifyAuth.isLoggedIn && global.ConnectifyAuth.isLoggedIn());
      const nudge = loggedIn ? '' : `
        <div class="cm-nudge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><a href="#" data-cm-login>Log in</a> to save your credits to an account.</span>
        </div>`;
      const pkgs = CREDIT_PACKAGES.map(p => `
        <button type="button" class="cm-pkg${p.badge ? ' cm-pkg--featured' : ''}" data-cm-pkg="${p.id}">
          ${p.badge ? `<span class="cm-pkg-badge">${escHTML(p.badge)}</span>` : ''}
          <span class="cm-pkg-info">
            <span class="cm-pkg-credits">${p.credits.toLocaleString()} credits</span>
            <span class="cm-pkg-label">${escHTML(p.label)}</span>
          </span>
          <span class="cm-pkg-price">$${p.price}</span>
        </button>
      `).join('');
      bodyEl.innerHTML = `
        <button type="button" class="cm-back" data-cm-back>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        ${nudge}
        <div class="cm-pkgs">${pkgs}</div>
        <div class="cm-fineprint">Pay-as-you-go credits, billed through our compute partner. No subscription — credits never expire.</div>
      `;
      bodyEl.querySelector('[data-cm-back]').addEventListener('click', renderBalance);
      const loginLink = bodyEl.querySelector('[data-cm-login]');
      if (loginLink) {
        loginLink.addEventListener('click', (e) => {
          e.preventDefault();
          if (global.ConnectifyAuth && global.ConnectifyAuth.navigateToAuth) {
            // Return straight back into the buy flow after auth.
            global.ConnectifyAuth.navigateToAuth('login', 'graphs-hub.html?tab=dashboard&credits=1');
          }
        });
      }
      bodyEl.querySelectorAll('[data-cm-pkg]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pkg = CREDIT_PACKAGES.find(p => p.id === btn.dataset.cmPkg);
          if (pkg) startCheckout(pkg);
        });
      });
    }

    // Simulated checkout — a short spinner stands in for the redirect to
    // the payment provider. On "success" we credit the balance locally.
    function startCheckout(pkg) {
      titleEl.textContent = 'Processing';
      locked = true;
      bodyEl.innerHTML = `
        <div class="cm-state">
          <div class="cm-spinner"></div>
          <div class="cm-state-title" style="margin-top:16px;">Processing payment…</div>
          <div class="cm-state-desc">Securing ${pkg.credits.toLocaleString()} credits via our compute partner.</div>
        </div>
      `;
      setTimeout(() => {
        locked = false;
        const newBalance = addCredits(pkg.credits);
        renderSuccess(pkg, newBalance);
      }, 1400);
    }

    function renderSuccess(pkg, newBalance) {
      titleEl.textContent = 'Purchase complete';
      bodyEl.innerHTML = `
        <div class="cm-state">
          <div class="cm-success-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="cm-state-title">+${pkg.credits.toLocaleString()} credits added</div>
          <div class="cm-state-desc">Your purchase was successful.</div>
          <div class="cm-state-balance">New balance: ${newBalance.toLocaleString()} credits</div>
          <button type="button" class="cm-done-btn" data-cm-done>Done</button>
        </div>
      `;
      bodyEl.querySelector('[data-cm-done]').addEventListener('click', renderBalance);
    }

    // Initial view.
    if (opts.view === 'buy') renderBuy();
    else renderBalance();
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
  function _isLeftnavCollapsed() {
    // Each page tracks expanded state on a different element:
    //   editing-mode / view-mode → .app.leftnav-expanded
    //   graphs-hub               → body.sidebar-expanded
    const app = document.querySelector('.app');
    if (app) return !app.classList.contains('leftnav-expanded');
    return !document.body.classList.contains('sidebar-expanded');
  }
  function _expandLeftnav() {
    const app = document.querySelector('.app');
    if (app) {
      app.classList.add('leftnav-expanded');
      try { localStorage.setItem('cfg.leftnav.expanded', '1'); } catch (_) {}
      return;
    }
    document.body.classList.add('sidebar-expanded');
    try { localStorage.setItem('cfg.leftnav.expanded', '1'); } catch (_) {}
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
      // Special-case: when the whole leftnav is collapsed, the section
      // header is just a folder icon — clicking it expands the leftnav
      // (and ensures the section itself ends up expanded).
      if (_isLeftnavCollapsed()) {
        _expandLeftnav();
        if (wrap.dataset.expanded !== 'true') {
          wrap.dataset.expanded = 'true';
          toggle.setAttribute('aria-expanded', 'true');
          _writeCollapseState(wrapId, true);
        }
        return;
      }
      const expanded = wrap.dataset.expanded === 'true';
      const next = !expanded;
      wrap.dataset.expanded = next ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', String(next));
      _writeCollapseState(wrapId, next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireProjectLinksOnce();
      wireNavEditLinkOnce();
      wireHubTabLinksOnce();
    });
  } else {
    wireProjectLinksOnce();
    wireNavEditLinkOnce();
    wireHubTabLinksOnce();
  }

  // Reflect the stored balance in the leftnav badge as soon as the DOM
  // is ready (the static HTML ships a hardcoded "100 credits" default).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncCreditsBadge);
  } else {
    syncCreditsBadge();
  }

  global.ConnectifyLeftnav = {
    renderProjects,
    readCustomProjects,
    resolveProjectSlug,
    resolveHubTab,
    rememberProjectNav,
    stashNavHint,
    stashHubTab,
    showCreditsModal,
    wireCollapsable,
    getCreditsBalance,
    getCreditsCap,
    addCredits,
    setCreditsBalance,
    syncCreditsBadge,
  };
})(window);
