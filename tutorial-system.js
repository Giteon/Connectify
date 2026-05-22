/* ============================================================
   tutorial-system.js — First-time-user guided tour
   ============================================================
   Cross-page state machine driving a tooltip + highlight overlay
   through 14 steps. Each page loads this script and calls
   `ConnectifyTutorial.init({ page, steps })` after its own DOM
   is ready. State persists in localStorage so navigation between
   landing → hub → view-mode → editing-mode keeps the same step.

   Public API on `window.ConnectifyTutorial`:
     init({ page, steps })   — register page; resume if applicable
     start()                 — begin from step 1 (also: persists state)
     skip()                  — mark skipped, hide overlay
     complete()              — mark completed, hide overlay
     reset()                 — wipe state (useful for re-running)
     advanceTo(stepId)       — jump to a specific step
     next()                  — advance to next step in the list
     back()                  — go back to previous step
     notifyAction(name, ctx) — user did something; may advance step
     isActive()              — overlay currently shown?
     isAvailableOnPage()     — current page has a step to show?
     getState()              — read current persisted state

   Page values: 'hub' | 'view' | 'edit'
   ============================================================ */
(function (global) {
  'use strict';

  const STATE_KEY = 'cfg.tutorialState';

  // ---- State helpers ----
  function defaultState() {
    return {
      started: false,
      currentStep: 0,           // step id (number 1-14); 0 = not started
      completedSteps: [],
      skipped: false,
      completed: false,
      lastActivity: Date.now(),
    };
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (_) {
      return defaultState();
    }
  }

  function writeState(s) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(
        Object.assign({}, s, { lastActivity: Date.now() })
      ));
    } catch (_) {}
  }

  function clearState() {
    try { localStorage.removeItem(STATE_KEY); } catch (_) {}
  }

  // ---- Runtime ----
  let currentPage = null;        // 'hub' | 'view' | 'edit'
  let registeredSteps = [];      // steps applicable to currentPage
  let activeStepId = 0;          // step currently being shown (0 = none)
  let positionRaf = 0;
  let resizeBound = false;
  let observerBound = false;
  let waitForElTimer = 0;

  // ---- DOM lookup helpers ----
  function getOverlay() { return document.getElementById('tutorialBackdrop'); }
  function getHighlight() { return document.getElementById('tutorialHighlight'); }
  function getTooltip() { return document.getElementById('tutorialTooltip'); }

  // ---- Step utility ----
  function findStep(id) {
    return registeredSteps.find(s => s && s.id === id) || null;
  }

  function totalStepCount() {
    // Show "step N of 14" regardless of page (matches plan)
    return 14;
  }

  // ---- Public API ----
  const api = {};

  api.init = function init(opts) {
    opts = opts || {};
    currentPage = opts.page || null;
    registeredSteps = Array.isArray(opts.steps) ? opts.steps.slice() : [];
    bindGlobalControls();
    // Defer resume so the host page can finish wiring up its own DOM/listeners first.
    setTimeout(resume, 0);
  };

  api.start = function start() {
    const s = readState();
    if (s.completed || s.skipped) {
      // explicit restart: clear "skipped/completed" but resume known step
      // (start() called from an explicit "Start tutorial" button)
    }
    s.started = true;
    s.skipped = false;
    s.completed = false;
    if (!s.currentStep) s.currentStep = 1;
    writeState(s);
    showStep(s.currentStep);
  };

  api.skip = function skip() {
    const s = readState();
    s.skipped = true;
    s.completed = false;
    writeState(s);
    hideOverlay();
  };

  api.complete = function complete() {
    const s = readState();
    s.completed = true;
    s.skipped = false;
    writeState(s);
    hideOverlay();
  };

  api.reset = function reset() {
    clearState();
    hideOverlay();
  };

  api.advanceTo = function advanceTo(stepId) {
    const s = readState();
    if (!s.completedSteps.includes(s.currentStep) && s.currentStep && s.currentStep < stepId) {
      s.completedSteps.push(s.currentStep);
    }
    s.currentStep = stepId;
    s.started = true;
    writeState(s);
    showStep(stepId);
  };

  api.next = function next() {
    const s = readState();
    const nextId = s.currentStep + 1;
    if (nextId > totalStepCount()) {
      api.complete();
      return;
    }
    api.advanceTo(nextId);
  };

  api.back = function back() {
    const s = readState();
    const prevId = Math.max(1, s.currentStep - 1);
    s.currentStep = prevId;
    writeState(s);
    showStep(prevId);
  };

  api.notifyAction = function notifyAction(name, ctx) {
    const step = findStep(activeStepId);
    if (!step || !step.actionTrigger) return;
    if (step.actionTrigger === name) {
      // Optional payload validator (returns truthy to advance)
      if (typeof step.actionGuard === 'function' && !step.actionGuard(ctx)) return;
      api.next();
    }
  };

  api.isActive = function isActive() {
    const overlay = getOverlay();
    return !!(overlay && overlay.classList.contains('active'));
  };

  api.isAvailableOnPage = function isAvailableOnPage() {
    const s = readState();
    if (s.skipped || s.completed) return false;
    if (!s.started) return false;
    const step = findStep(s.currentStep);
    return !!step;
  };

  api.getState = function getState() {
    return readState();
  };

  // ---- Resume logic on page load ----
  function resume() {
    const s = readState();
    if (s.skipped || s.completed) return;
    if (!s.started) return;                // not yet started; host page can decide to start()
    const step = findStep(s.currentStep);
    if (!step) return;                     // this page doesn't host the current step
    showStep(s.currentStep);
  }

  // ---- Show / hide ----
  function showStep(stepId) {
    activeStepId = stepId;
    const step = findStep(stepId);
    if (!step) {
      hideOverlay();
      return;
    }
    if (typeof step.onBeforeShow === 'function') {
      try { step.onBeforeShow(); } catch (_) {}
    }
    // Wait for the target element to exist before drawing
    waitForElement(step, () => {
      renderTooltip(step);
      positionOverlay(step);
      bindResize();
      observeDom(step);
      try { step.onShow && step.onShow(); } catch (_) {}
    });
  }

  function hideOverlay() {
    activeStepId = 0;
    const ovl = getOverlay();
    if (ovl) {
      ovl.classList.remove('active');
      ovl.setAttribute('aria-hidden', 'true');
    }
    unbindResize();
    disconnectObserver();
    clearWaitTimer();
  }

  // ---- DOM rendering ----
  function renderTooltip(step) {
    const ovl = getOverlay();
    const tip = getTooltip();
    if (!ovl || !tip) return;

    // Body
    const titleEl = tip.querySelector('[data-tt-title]');
    const textEl = tip.querySelector('[data-tt-text]');
    const videoSlot = tip.querySelector('[data-tt-video]');
    const stepNumEl = tip.querySelector('[data-tt-step-num]');
    const stepTotalEl = tip.querySelector('[data-tt-step-total]');
    const actionsEl = tip.querySelector('[data-tt-actions]');

    if (titleEl) titleEl.textContent = step.title || '';
    if (textEl) textEl.textContent = step.text || '';

    // Video (optional). MP4 auto-play muted looping; gracefully hidden on error.
    if (videoSlot) {
      videoSlot.innerHTML = '';
      if (step.video) {
        const v = document.createElement('video');
        v.src = step.video;
        v.autoplay = true;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('preload', 'metadata');
        // If file is missing or fails to load, fully hide the slot.
        v.addEventListener('error', () => { videoSlot.style.display = 'none'; }, { once: true });
        videoSlot.style.display = '';
        videoSlot.appendChild(v);
        // Some browsers need a poke
        try { v.play().catch(() => {}); } catch (_) {}
      } else {
        videoSlot.style.display = 'none';
      }
    }

    // Progress
    if (stepNumEl) stepNumEl.textContent = String(step.id);
    if (stepTotalEl) stepTotalEl.textContent = String(totalStepCount());

    // Actions
    if (actionsEl) {
      const s = readState();
      const isFirst = step.id <= 1;
      const isLast = step.id >= totalStepCount();
      const waitsForAction = !!step.actionTrigger;
      actionsEl.innerHTML = `
        <button type="button" class="tt-btn tt-btn-secondary" data-tt-act="back" ${isFirst ? 'disabled' : ''}>Back</button>
        ${isLast
          ? '<button type="button" class="tt-btn tt-btn-primary" data-tt-act="complete">Got it</button>'
          : waitsForAction
            ? `<button type="button" class="tt-btn tt-btn-secondary" data-tt-act="next" title="Skip this step">Skip step</button>`
            : `<button type="button" class="tt-btn tt-btn-primary" data-tt-act="next">Next</button>`
        }
      `;
    }

    // Show overlay
    ovl.classList.add('active');
    ovl.setAttribute('aria-hidden', 'false');

    // Style: dim overlay vs lift target
    ovl.classList.toggle('tt-mode-action', !!step.actionTrigger);
    ovl.classList.toggle('tt-mode-info',   !step.actionTrigger);
    ovl.classList.toggle('tt-no-highlight', step.highlight === 'none');
  }

  // ---- Positioning ----
  function getTargetRect(step) {
    if (!step.selector || step.highlight === 'none') return null;
    const el = typeof step.selector === 'function'
      ? step.selector()
      : document.querySelector(step.selector);
    if (!el) return null;
    return el.getBoundingClientRect();
  }

  function positionOverlay(step) {
    cancelAnimationFrame(positionRaf);
    positionRaf = requestAnimationFrame(() => {
      const ovl = getOverlay();
      const hl = getHighlight();
      const tip = getTooltip();
      if (!ovl || !hl || !tip) return;

      const rect = getTargetRect(step);
      const pad = step.highlightPadding != null ? step.highlightPadding : 8;
      const pos = step.position || 'auto';

      if (rect) {
        // Highlight
        const x = Math.max(4, rect.left - pad);
        const y = Math.max(4, rect.top - pad);
        const w = rect.width + pad * 2;
        const h = rect.height + pad * 2;
        hl.style.display = '';
        hl.style.left = x + 'px';
        hl.style.top = y + 'px';
        hl.style.width = w + 'px';
        hl.style.height = h + 'px';
      } else {
        hl.style.display = 'none';
      }

      // Tooltip placement
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tipRect = tip.getBoundingClientRect();
      const tipW = tipRect.width || 340;
      const tipH = tipRect.height || 280;
      const gap = 14;
      let left, top;

      if (!rect || pos === 'center' || step.highlight === 'none') {
        left = Math.max(16, (vw - tipW) / 2);
        top = Math.max(16, (vh - tipH) / 2);
      } else {
        const placement = pos === 'auto' ? autoPick(rect, tipW, tipH, vw, vh, gap) : pos;
        ({ left, top } = computePlacement(placement, rect, tipW, tipH, gap));
        // Clamp to viewport
        left = Math.max(8, Math.min(left, vw - tipW - 8));
        top = Math.max(8, Math.min(top, vh - tipH - 8));
      }
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    });
  }

  function autoPick(rect, tipW, tipH, vw, vh, gap) {
    // Prefer the side with the most room
    const room = {
      bottom: vh - rect.bottom,
      top: rect.top,
      right: vw - rect.right,
      left: rect.left,
    };
    const order = Object.keys(room).sort((a, b) => room[b] - room[a]);
    for (const side of order) {
      if (side === 'bottom' && room.bottom >= tipH + gap + 8) return 'bottom';
      if (side === 'top'    && room.top    >= tipH + gap + 8) return 'top';
      if (side === 'right'  && room.right  >= tipW + gap + 8) return 'right';
      if (side === 'left'   && room.left   >= tipW + gap + 8) return 'left';
    }
    return 'bottom';
  }

  function computePlacement(placement, rect, tipW, tipH, gap) {
    switch (placement) {
      case 'top':    return { left: rect.left + rect.width / 2 - tipW / 2, top: rect.top - tipH - gap };
      case 'bottom': return { left: rect.left + rect.width / 2 - tipW / 2, top: rect.bottom + gap };
      case 'left':   return { left: rect.left - tipW - gap, top: rect.top + rect.height / 2 - tipH / 2 };
      case 'right':  return { left: rect.right + gap, top: rect.top + rect.height / 2 - tipH / 2 };
      default:       return { left: rect.left + rect.width / 2 - tipW / 2, top: rect.bottom + gap };
    }
  }

  // ---- Re-position on resize/scroll/DOM changes ----
  function bindResize() {
    if (resizeBound) return;
    resizeBound = true;
    window.addEventListener('resize', onLayoutChange, { passive: true });
    window.addEventListener('scroll', onLayoutChange, { passive: true, capture: true });
  }
  function unbindResize() {
    if (!resizeBound) return;
    resizeBound = false;
    window.removeEventListener('resize', onLayoutChange);
    window.removeEventListener('scroll', onLayoutChange, { capture: true });
  }
  function onLayoutChange() {
    const step = findStep(activeStepId);
    if (step) positionOverlay(step);
  }

  // ---- Wait for target element to appear (for transitions like modal opening) ----
  function waitForElement(step, cb) {
    clearWaitTimer();
    if (!step.selector || step.highlight === 'none') { cb(); return; }
    const find = () => {
      const el = typeof step.selector === 'function'
        ? step.selector()
        : document.querySelector(step.selector);
      return el && el.getBoundingClientRect().width > 0 ? el : null;
    };
    if (find()) { cb(); return; }
    let attempts = 0;
    const tick = () => {
      attempts++;
      if (find()) { cb(); return; }
      if (attempts > 60) { cb(); return; }   // give up after ~6s; show overlay anyway
      waitForElTimer = setTimeout(tick, 100);
    };
    waitForElTimer = setTimeout(tick, 100);
  }
  function clearWaitTimer() {
    if (waitForElTimer) { clearTimeout(waitForElTimer); waitForElTimer = 0; }
  }

  // ---- Observe DOM for layout-changing mutations under the target ----
  function observeDom(step) {
    disconnectObserver();
    if (!step || !step.selector) return;
    try {
      const target = document.body;
      const mo = new MutationObserver(() => onLayoutChange());
      mo.observe(target, { childList: true, subtree: true, attributes: true });
      api._observer = mo;
      observerBound = true;
    } catch (_) {}
  }
  function disconnectObserver() {
    if (api._observer) {
      try { api._observer.disconnect(); } catch (_) {}
      api._observer = null;
    }
    observerBound = false;
  }

  // ---- Global click handlers for tooltip action buttons + skip ----
  let globalBound = false;
  function bindGlobalControls() {
    if (globalBound) return;
    globalBound = true;
    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-tt-act]');
      if (!act) return;
      e.stopPropagation();
      const kind = act.dataset.ttAct;
      if (kind === 'next')     api.next();
      else if (kind === 'back') api.back();
      else if (kind === 'skip') api.skip();
      else if (kind === 'complete') api.complete();
      else if (kind === 'close') api.skip();
    });
    document.addEventListener('keydown', (e) => {
      if (!api.isActive()) return;
      if (e.key === 'Escape') {
        // Allow Escape to dismiss tutorial without breaking app shortcuts
        api.skip();
      }
    });
  }

  // Expose
  global.ConnectifyTutorial = api;
})(window);
