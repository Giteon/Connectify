/* ============================================================
   Shared dropdown nav behavior.

   Attaches to every `.nav-dd` on the page:
   - Click trigger to toggle open/close
   - Hover trigger to open (desktop only)
   - Esc / outside click to close
   - Arrow keys to move between items inside the open menu
   - Only one menu open at a time

   Idempotent: safe to load on every page; safe to re-run.
   ============================================================ */
(function () {
  if (window.__navDropdownInit) return;
  window.__navDropdownInit = true;

  const HOVER_OPEN_DELAY = 80;
  const HOVER_CLOSE_DELAY = 180;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  let openDropdown = null;
  let hoverTimer = null;

  function closeAll(except) {
    document.querySelectorAll('.nav-dd[data-open="true"]').forEach(dd => {
      if (dd === except) return;
      dd.dataset.open = 'false';
      const trigger = dd.querySelector('.nav-dd-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
    if (openDropdown !== except) openDropdown = except || null;
  }

  function openDd(dd) {
    if (!dd) return;
    closeAll(dd);
    dd.dataset.open = 'true';
    const trigger = dd.querySelector('.nav-dd-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    openDropdown = dd;
  }

  function closeDd(dd) {
    if (!dd) return;
    dd.dataset.open = 'false';
    const trigger = dd.querySelector('.nav-dd-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (openDropdown === dd) openDropdown = null;
  }

  function wire(dd) {
    if (dd.__wired) return;
    dd.__wired = true;
    const trigger = dd.querySelector('.nav-dd-trigger');
    if (!trigger) return;

    // Click toggle
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      if (dd.dataset.open === 'true') closeDd(dd);
      else openDd(dd);
    });

    // Hover open (desktop only)
    if (!isCoarsePointer) {
      dd.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => openDd(dd), HOVER_OPEN_DELAY);
      });
      dd.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => closeDd(dd), HOVER_CLOSE_DELAY);
      });
    }

    // Keyboard: arrows navigate items inside the menu
    dd.addEventListener('keydown', e => {
      const items = Array.from(dd.querySelectorAll('.nav-dd-item'));
      if (!items.length) return;
      const active = document.activeElement;
      const idx = items.indexOf(active);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (dd.dataset.open !== 'true') openDd(dd);
        const next = items[(idx + 1 + items.length) % items.length] || items[0];
        next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[(idx - 1 + items.length) % items.length] || items[items.length - 1];
        prev.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    });
  }

  function init() {
    document.querySelectorAll('.nav-dd').forEach(wire);
  }

  // Global close handlers
  document.addEventListener('click', e => {
    if (!openDropdown) return;
    if (!openDropdown.contains(e.target)) closeAll();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openDropdown) {
      const trigger = openDropdown.querySelector('.nav-dd-trigger');
      closeAll();
      if (trigger) trigger.focus();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
