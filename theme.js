// ── Dark-mode toggle ──────────────────────────────────────────
// Shared across dashboard / editing-mode / view-mode. The stored
// preference lives in localStorage under `cfg.theme` (values:
// "light" or "dark"). The theme is applied pre-paint by a small
// inline script in each HTML file so there's no flash-of-wrong-
// theme on load; this module handles everything else:
//   - injects the toggle button into .topbar-actions / .topbar-right
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

  // Slot the button in right before the user pill so its placement is
  // consistent across all three pages, regardless of container class
  // (dashboard uses .topbar-right; editing/view use .topbar-actions).
  function mount() {
    if (document.querySelector('.theme-toggle')) return;
    const avatarBtn = document.querySelector('.avatar-dropdown');
    // Fall back to `.topbar` for pages that don't wrap right-side controls
    // in their own actions container (e.g. editing-mode-new.html).
    const host = document.querySelector('.topbar-actions, .topbar-right, .topbar');
    if (!host) return;
    const btn = buildButton();
    if (avatarBtn && avatarBtn.parentElement === host) host.insertBefore(btn, avatarBtn);
    else host.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // Keep theme in sync across open tabs.
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    applyTheme(e.newValue === 'dark' ? 'dark' : 'light');
  });
})();
