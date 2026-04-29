// ── Dark-mode toggle ──────────────────────────────────────────
// Shared across dashboard / editing-mode / view-mode. The stored
// preference lives in localStorage under `cfg.theme` (values:
// "light" or "dark"). The theme is applied pre-paint by a small
// inline script in each HTML file so there's no flash-of-wrong-
// theme on load; this module handles everything else:
//   - injects the toggle into `[data-theme-slot]` if present, else
//     .topbar-actions / .topbar-right` (before .avatar-dropdown when present)
//   - wires the click handler
//   - re-syncs across tabs via the `storage` event
(function () {
  const KEY = 'cfg.theme';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') html.setAttribute('data-theme', 'dark');
    else                  html.removeAttribute('data-theme');
    try { localStorage.setItem(KEY, theme); } catch (_) { /* storage quota */ }
    // If the canvas module is active, edge colors/dot layers read from
    // CSS variables via SVG strokes — force a redraw so any cached styling
    // picks up the new values.
    if (window.Canvas && typeof window.Canvas.drawEdges === 'function') {
      try { window.Canvas.drawEdges(); } catch (_) { /* no-op if not ready */ }
    }
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  // Icon markup: sun + moon in the same button. CSS shows whichever
  // matches the current theme. aria-label flips so screen readers
  // hear the action, not the state.
  function buildButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.title = 'Toggle dark mode';
    btn.innerHTML = `
      <svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
      <svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>`;
    btn.addEventListener('click', toggleTheme);
    return btn;
  }

  function buildTopbarSearch() {
    const wrap = document.createElement('div');
    wrap.className = 'topbar-search';
    wrap.innerHTML = `
      <button type="button" class="topbar-search-btn" aria-label="Search" title="Search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </button>
      <input type="search" class="topbar-search-input" placeholder="Search graphs, models, datasets..." />
    `;
    const btn = wrap.querySelector('.topbar-search-btn');
    const input = wrap.querySelector('.topbar-search-input');
    const app = document.querySelector('.app');
    const topbar = app?.querySelector('.topbar') ?? document.querySelector('.topbar');
    const mid = document.getElementById('topbarMidActions');
    const syncMidA11y = (expanded) => {
      if (!mid) return;
      mid.setAttribute('aria-hidden', expanded ? 'true' : 'false');
    };
    const open = () => {
      wrap.classList.add('open');
      topbar?.classList.add('topbar-search-expanded');
      syncMidA11y(true);
      setTimeout(() => input.focus(), 50);
    };
    const close = () => {
      wrap.classList.remove('open');
      topbar?.classList.remove('topbar-search-expanded');
      syncMidA11y(false);
      input.blur();
    };
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (wrap.classList.contains('open')) close();
      else open();
    });
    document.addEventListener('mousedown', (e) => {
      if (!wrap.classList.contains('open')) return;
      if (wrap.contains(e.target)) return;
      close();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    return wrap;
  }

  // Preferred: `[data-theme-slot]` (end of topbar / rail). Otherwise insert before
  // `.avatar-dropdown` in `.topbar-actions` / `.topbar-right`, else append to `.topbar`.
  function mount() {
    if (document.querySelector('.theme-toggle')) return;
    const slot = document.querySelector('[data-theme-slot]');
    const search = buildTopbarSearch();
    const btn = buildButton();
    if (slot) {
      const end = slot.closest('.topbar-end');
      if (end) {
        slot.appendChild(search);
        const menuToggle = document.getElementById('topbarMenuToggle');
        if (menuToggle && menuToggle.parentElement === end) end.insertBefore(btn, menuToggle);
        else end.appendChild(btn);
      } else {
        // Rail slot (e.g. leftnav): mount only the theme toggle there and keep
        // search in the topbar cluster.
        slot.appendChild(btn);
        const searchSlot = document.querySelector('[data-search-slot]');
        if (searchSlot && !searchSlot.querySelector('.topbar-search')) {
          searchSlot.appendChild(search);
          return;
        }
        const host = document.querySelector('.topbar-end, .topbar-actions, .topbar-right, .topbar');
        if (host && !host.querySelector('.topbar-search')) {
          const avatarBtn = host.querySelector('.leftnav-avatar, .avatar-dropdown');
          if (avatarBtn) host.insertBefore(search, avatarBtn);
          else host.appendChild(search);
        }
      }
      return;
    }
    const avatarBtn = document.querySelector('.avatar-dropdown');
    const host = document.querySelector('.topbar-actions, .topbar-right, .topbar');
    if (!host) return;
    if (avatarBtn && avatarBtn.parentElement === host) {
      host.insertBefore(search, avatarBtn);
      host.insertBefore(btn, avatarBtn);
    } else {
      host.appendChild(search);
      host.appendChild(btn);
    }
  }

  function isLeftnavCollapsed() {
    const app = document.querySelector('.app');
    if (app) return !app.classList.contains('leftnav-expanded');
    return !document.body.classList.contains('sidebar-expanded');
  }

  function expandLeftnav() {
    if (!isLeftnavCollapsed()) return;
    const app = document.querySelector('.app');
    const KEY = 'cfg.leftnav.expanded';
    if (app) {
      app.classList.add('leftnav-expanded');
      document.documentElement.setAttribute('data-leftnav', 'expanded');
    } else {
      document.body.classList.add('sidebar-expanded');
    }
    try { localStorage.setItem(KEY, '1'); } catch (_) { /* no-op */ }
  }

  function initLeftnavAvatarDropdown() {
    const avatarBtn = document.querySelector('.leftnav-avatar');
    if (!avatarBtn || avatarBtn.dataset.dropdownBound === '1') return;
    avatarBtn.dataset.dropdownBound = '1';
    avatarBtn.setAttribute('aria-haspopup', 'menu');
    avatarBtn.setAttribute('aria-expanded', 'false');

    const pop = document.createElement('div');
    pop.className = 'leftnav-avatar-pop';
    pop.hidden = true;
    pop.innerHTML = `
      <button type="button" data-action="profile">View profile</button>
      <button type="button" data-action="Settings">Settings</button>
    `;
    document.body.appendChild(pop);

    function position() {
      const r = avatarBtn.getBoundingClientRect();
      pop.style.width = 'max-content';
      pop.style.maxWidth = `${Math.max(120, window.innerWidth - 16)}px`;
      const wasHidden = pop.hidden;
      if (wasHidden) {
        pop.hidden = false;
        pop.style.visibility = 'hidden';
      }
      const popW = Math.ceil(pop.getBoundingClientRect().width || Math.round(r.width));
      if (wasHidden) {
        pop.hidden = true;
        pop.style.visibility = '';
      }
      let left = r.right - popW;
      left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
      pop.style.left = `${left}px`;
      pop.style.top = `${r.bottom + 6}px`;
    }

    function open() {
      position();
      pop.hidden = false;
      avatarBtn.setAttribute('aria-expanded', 'true');
    }

    function close() {
      pop.hidden = true;
      avatarBtn.setAttribute('aria-expanded', 'false');
    }

    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (avatarBtn.closest('.leftnav') && isLeftnavCollapsed()) {
        expandLeftnav();
        close();
        return;
      }
      if (pop.hidden) open();
      else close();
    });

    pop.addEventListener('click', () => {
      close();
    });

    document.addEventListener('mousedown', (e) => {
      if (pop.hidden) return;
      if (pop.contains(e.target) || avatarBtn.contains(e.target)) return;
      close();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    window.addEventListener('resize', () => {
      if (!pop.hidden) position();
    });
    window.addEventListener('scroll', () => {
      if (!pop.hidden) position();
    }, true);
  }

  function initLeftnavEnhancements() {
    document.querySelectorAll('.nav-item-stub').forEach((el) => {
      if (el.dataset.bound === '1') return;
      el.dataset.bound = '1';
      el.addEventListener('click', (e) => e.preventDefault());
    });
    initLeftnavAvatarDropdown();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mount();
      initLeftnavEnhancements();
    });
  } else {
    mount();
    initLeftnavEnhancements();
  }

  // Keep theme in sync across open tabs.
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    applyTheme(e.newValue === 'dark' ? 'dark' : 'light');
  });
})();
