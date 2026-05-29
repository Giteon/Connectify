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
  let markedTargetEl = null;     // element currently tagged with .tt-target

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
    let prevId = Math.max(1, s.currentStep - 1);
    // Clamp to the lowest step ID that exists on the current page. Going to a
    // step that belongs to a different page would just hide the overlay silently
    // (its selector wouldn't be found), which feels broken to users.
    const lowestOnPage = registeredSteps.reduce(
      (acc, step) => (step && step.id < acc ? step.id : acc),
      Infinity
    );
    if (isFinite(lowestOnPage) && prevId < lowestOnPage) prevId = lowestOnPage;
    s.currentStep = prevId;
    writeState(s);
    showStep(prevId);
  };

  api.notifyAction = function notifyAction(name, ctx) {
    // Read the step from persisted state (not the in-memory activeStepId).
    // The overlay might still be resolving its target (waitForElement polling),
    // in which case activeStepId is 0 and the action would be silently dropped.
    // The user's action is the source of truth — if they did the thing the
    // current step is waiting for, advance regardless of overlay readiness.
    const state = readState();
    if (state.skipped || state.completed) return;
    if (!state.started) return;
    const step = findStep(state.currentStep);
    if (!step || !step.actionTrigger) return;
    if (step.actionTrigger !== name) return;
    if (typeof step.actionGuard === 'function' && !step.actionGuard(ctx)) return;
    api.next();
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
    // Fire onAfterHide for the step we're leaving so it can clean up any
    // DOM state it temporarily mutated (e.g. force-revealing a hidden panel).
    const leavingStep = findStep(activeStepId);
    if (leavingStep && leavingStep.id !== stepId && typeof leavingStep.onAfterHide === 'function') {
      try { leavingStep.onAfterHide(); } catch (_) {}
    }
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
      // Re-position once content has settled. The tooltip starts with
      // opacity:0 and may grow as the video loads or fonts swap.
      setTimeout(() => { if (activeStepId === step.id) positionOverlay(step); }, 80);
      setTimeout(() => { if (activeStepId === step.id) positionOverlay(step); }, 320);
      try { step.onShow && step.onShow(); } catch (_) {}
    });
  }

  function hideOverlay() {
    // Fire onAfterHide for the step we're leaving (skip / complete / reset)
    // so it can undo any DOM tweaks (e.g. revealed panels).
    const leavingStep = findStep(activeStepId);
    if (leavingStep && typeof leavingStep.onAfterHide === 'function') {
      try { leavingStep.onAfterHide(); } catch (_) {}
    }
    activeStepId = 0;
    const ovl = getOverlay();
    if (ovl) {
      ovl.classList.remove('active');
      ovl.setAttribute('aria-hidden', 'true');
    }
    setMarkedTarget(null);
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

    // Actions. Disable Back when there's no earlier step available on the
    // current page (a) globally first step, or (b) first step of this page —
    // since `back()` clamps to lowest-on-page, hitting Back here would no-op.
    if (actionsEl) {
      const lowestOnPage = registeredSteps.reduce(
        (acc, st) => (st && st.id < acc ? st.id : acc),
        Infinity
      );
      const isFirst = step.id <= 1 || step.id <= lowestOnPage;
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
  // The target element is used for BOTH the highlight box AND tooltip
  // anchoring. `highlight: 'none'` only suppresses the visible box — the
  // tooltip is still anchored to the selector if one is provided. To force
  // a centered tooltip (no anchor), set selector: null on the step.
  function getTargetEl(step) {
    if (!step.selector) return null;
    return typeof step.selector === 'function'
      ? step.selector()
      : document.querySelector(step.selector);
  }
  function getTargetRect(step) {
    const el = getTargetEl(step);
    return el ? el.getBoundingClientRect() : null;
  }

  function setMarkedTarget(el) {
    if (markedTargetEl === el) return;
    if (markedTargetEl) {
      try { markedTargetEl.classList.remove('tt-target'); } catch (_) {}
    }
    markedTargetEl = el;
    if (el) {
      try { el.classList.add('tt-target'); } catch (_) {}
    }
  }

  function positionOverlay(step) {
    cancelAnimationFrame(positionRaf);
    positionRaf = requestAnimationFrame(() => {
      const ovl = getOverlay();
      const hl = getHighlight();
      const tip = getTooltip();
      if (!ovl || !hl || !tip) return;

      const el = getTargetEl(step);
      setMarkedTarget(el);
      const rect = el ? el.getBoundingClientRect() : null;
      const pad = step.highlightPadding != null ? step.highlightPadding : 8;
      const pos = step.position || 'auto';
      const showHighlight = step.highlight !== 'none' && !!rect;

      if (showHighlight) {
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
        // Match the target's border-radius so round buttons get round halos.
        // Add the highlight padding so the curve hugs the offset rect cleanly.
        try {
          const cs = getComputedStyle(el);
          const raw = parseFloat(cs.borderTopLeftRadius) || 0;
          // For pill-shaped targets (radius >= half height), keep it pill.
          const isPill = raw >= Math.min(rect.width, rect.height) / 2 - 1;
          const r = isPill
            ? (Math.min(w, h) / 2)
            : Math.max(6, Math.min(28, raw + pad));
          hl.style.borderRadius = r + 'px';
        } catch (_) {
          hl.style.borderRadius = '12px';
        }
      } else {
        hl.style.display = 'none';
      }

      // Tooltip placement.
      // offsetWidth/Height return the laid-out size even when opacity is 0
      // (which it is on the first frame because of our fade-in). Falling
      // back to fixed 340/280 produced misplaced tooltips on the first
      // render of every step.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tipW = tip.offsetWidth || 340;
      const tipH = tip.offsetHeight || 280;
      const gap = 14;
      let left, top;

      // Center the tooltip only when there's truly nothing to anchor against
      // (no target selector at all) OR the step explicitly asks for center.
      // `highlight: 'none'` no longer forces centering — it only hides the box.
      if (!rect || pos === 'center') {
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
    // No selector at all → nothing to wait for (e.g. final completion modal).
    // Steps with `highlight: 'none'` still need their selector resolved so the
    // tooltip can anchor against it; we keep waiting for those.
    if (!step.selector) { cb(); return; }
    const find = () => {
      const el = typeof step.selector === 'function'
        ? step.selector()
        : document.querySelector(step.selector);
      return el && el.getBoundingClientRect().width > 0 ? el : null;
    };
    const ready = (el) => {
      // Scroll target into view if it's off-screen, then call cb on next frame
      // so positionOverlay sees the updated rect.
      try {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const offscreen =
          r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw;
        if (offscreen && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          // Give scroll a chance to settle before positioning.
          setTimeout(cb, 350);
          return;
        }
      } catch (_) {}
      cb();
    };
    const hit = find();
    if (hit) { ready(hit); return; }
    let attempts = 0;
    const tick = () => {
      attempts++;
      const el = find();
      if (el) { ready(el); return; }
      if (attempts > 60) { cb(); return; }   // give up after ~6s; show overlay anyway
      waitForElTimer = setTimeout(tick, 100);
    };
    waitForElTimer = setTimeout(tick, 100);
  }
  function clearWaitTimer() {
    if (waitForElTimer) { clearTimeout(waitForElTimer); waitForElTimer = 0; }
  }

  // ---- Observe DOM for layout-changing mutations near the target ----
  // We only watch a narrow subtree (the target's nearest scrollable/positioned
  // ancestor or BODY) and **exclude** mutations originating from inside the
  // tutorial overlay itself. Watching all of document.body with `attributes:true`
  // creates an infinite re-position loop because positioning writes style attrs
  // back to the tooltip/highlight, which the observer would then react to.
  let _observer = null;
  function observeDom(step) {
    disconnectObserver();
    if (!step || !step.selector) return;
    try {
      const targetEl = getTargetEl(step);
      const watchRoot = (targetEl && targetEl.parentElement) || document.body;
      const overlay = getOverlay();
      const mo = new MutationObserver((mutations) => {
        // Ignore mutations rooted inside the tutorial overlay — those are
        // changes we caused ourselves.
        for (const m of mutations) {
          if (overlay && (m.target === overlay || overlay.contains(m.target))) continue;
          onLayoutChange();
          return;
        }
      });
      // childList + subtree catches insertions / removals near the target.
      // We deliberately skip `attributes:true` to avoid pathological churn.
      mo.observe(watchRoot, { childList: true, subtree: true });
      _observer = mo;
      observerBound = true;
    } catch (_) {}
  }
  function disconnectObserver() {
    if (_observer) {
      try { _observer.disconnect(); } catch (_) {}
      _observer = null;
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
    // Escape is reserved for closing modals/dropdowns in the host app;
    // tutorial dismissal is intentional via the × button or "Skip" action.
  }

  // Expose
  global.ConnectifyTutorial = api;
})(window);
