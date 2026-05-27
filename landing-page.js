(() => {
  const tabs = document.querySelectorAll('.lp-tab');
  const mocks = document.querySelectorAll('.lp-mock');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      mocks.forEach((m) => m.classList.toggle('active', m.dataset.mock === id));
    });
  });
})();

/* Light/dark mock screenshots + frame width and aspect-ratio from assets. */
(() => {
  const wrap = document.querySelector('.lp-mock-wrap');
  if (!wrap) return;
  const imgs = [...wrap.querySelectorAll('.lp-mock-img')];
  if (!imgs.length) return;

  function lpDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function applyMockSrcs() {
    imgs.forEach((img) => {
      const light = img.getAttribute('data-src-light') || '';
      const dark = img.getAttribute('data-src-dark') || '';
      const next = lpDark() ? (dark || light) : (light || dark);
      if (next) img.src = next;
    });
  }

  let resizeTimer;
  function applySize() {
    const loaded = imgs.filter((img) => img.naturalWidth > 0 && img.naturalHeight > 0);
    if (!loaded.length) return;

    const ref =
      loaded.find((img) => img.closest('.lp-mock')?.dataset.mock === 'build') || loaded[0];
    const nw = ref.naturalWidth;
    const nh = ref.naturalHeight;
    wrap.style.setProperty('--lp-mock-ar', `${nw} / ${nh}`);

    const maxNaturalW = Math.max(...loaded.map((img) => img.naturalWidth));
    const parent = wrap.parentElement || document.documentElement;
    const pad = 72;
    const avail = Math.max(280, parent.getBoundingClientRect().width - pad);
    const w = Math.min(maxNaturalW, avail);

    wrap.style.setProperty('--lp-mock-w', `${Math.round(w)}px`);
    wrap.classList.add('is-sized');
  }

  function scheduleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applySize, 80);
  }

  function waitImages() {
    return Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })
      )
    );
  }

  function syncMocks() {
    applyMockSrcs();
    return waitImages().then(() => {
      applySize();
    });
  }

  syncMocks().then(() => {
    window.addEventListener('resize', scheduleResize, { passive: true });
  });

  document.addEventListener('lp-theme-changed', () => {
    syncMocks();
  });
})();

/* ── Headline-as-graph ─────────────────────────────────────
   Each word in the hero headline is a draggable node connected
   in sequence by SVG bezier edges. Edges are pointer-events:none
   so they read as decoration, not chrome. */
(() => {
  const wrap = document.getElementById('lpHeadlineGraph');
  if (!wrap) return;
  const nodes = [...wrap.querySelectorAll('.lp-node')];
  const svg = wrap.querySelector('.lp-edges');
  if (!nodes.length || !svg) return;

  // Helper: read/write the word inside a node. Each node contains a single
  // `.lp-node-word` span; reading textContent of the node could trip on
  // outgoing-swap clones during the slot animation, so we go through the
  // current child directly.
  const wordEl = (n) => n.querySelector('.lp-node-word:not(.is-swap-out)');
  const wordOf = (n) => (wordEl(n) ? wordEl(n).textContent.trim() : '');

  // Alternate headlines the shuffle button cycles through. Each is six
  // tokens to keep a 1:1 map with the six nodes. Words that match the
  // previous sentence stay; only the changed words actually swap text.
  const SENTENCES = [
    ['The',     'graph',       'collaboration', 'platform', 'for',  'researchers'],
    ['Run',     'experiments', 'live',          'in',       'your', 'browser'    ],
    ['Fork',    'any',         'graph',         'with',     'one',  'click'      ],
    ['Branch',  'your',        'science',       'like',     'real', 'software'   ],
    ['Built',   'open.',       'Powered',       'by',       'the',  'community'  ],
    ['Ship',    'research',    'faster',        'than',     'ever', 'before'     ]
  ];
  let sentenceIdx = 0;

  // Snake layout: split words across two rows, centered on each row.
  function layout() {
    const w = wrap.clientWidth;
    const half = Math.ceil(nodes.length / 2);
    // offsetWidth still reflects the rendered content width even when the
    // node is absolutely positioned, so we read it directly without
    // clearing left/top (clearing would cause a flash mid-animation).
    const widths = nodes.map((n) => n.offsetWidth || 100);
    const heights = nodes.map((n) => n.offsetHeight || 60);
    const gap = 18;
    const place = (start, end, y) => {
      const total = widths.slice(start, end).reduce((a, b) => a + b, 0) + gap * (end - start - 1);
      let x = Math.max(0, (w - total) / 2);
      for (let i = start; i < end; i++) {
        nodes[i].style.left = `${x}px`;
        nodes[i].style.top = `${y}px`;
        x += widths[i] + gap;
      }
    };
    const rowH = heights[0] || 60;
    const y1 = 20;
    const y2 = y1 + rowH + 36;
    place(0, half, y1);
    place(half, nodes.length, y2);
    drawEdges();
  }

  // Snapshot of the rect each node would have at canonical layout. Used to
  // detect "already-tidy" state for the bounce, and to feed the frozen
  // edge-endpoint computation during the reset animation.
  function computeCanonicalTargets() {
    // Save current style to restore after measurement
    const saved = nodes.map((n) => ({ left: n.style.left, top: n.style.top }));
    layout();
    const targets = nodes.map((n) => ({ left: n.style.left, top: n.style.top }));
    nodes.forEach((n, i) => {
      n.style.left = saved[i].left;
      n.style.top  = saved[i].top;
    });
    return targets;
  }

  // Edges flip "side" depending on the relative position of consecutive
  // nodes (right→left vs. bottom→top for row wraps). During an animated
  // reset that flip can occur mid-flight and read as a glitch — so we
  // freeze the side decision for the duration of the animation and only
  // recompute once the nodes have settled.
  let frozenEdgeSides = null;

  function computeEdgeSides(getRect) {
    const sides = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = getRect(nodes[i]);
      const b = getRect(nodes[i + 1]);
      sides.push(b.left > a.right - 8 ? 'horizontal' : 'wrap');
    }
    return sides;
  }

  function drawEdges() {
    const wrapBox = wrap.getBoundingClientRect();
    const out = [];
    const sides = frozenEdgeSides || computeEdgeSides((n) => n.getBoundingClientRect());
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i].getBoundingClientRect();
      const b = nodes[i + 1].getBoundingClientRect();
      const aRight = a.right - wrapBox.left;
      const aBottom = a.bottom - wrapBox.top;
      const aMidY = a.top + a.height / 2 - wrapBox.top;
      const bLeft = b.left - wrapBox.left;
      const bTop = b.top - wrapBox.top;
      const bMidY = b.top + b.height / 2 - wrapBox.top;
      let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
      if (sides[i] === 'horizontal') {
        x1 = aRight; y1 = aMidY;
        x2 = bLeft; y2 = bMidY;
        const dx = Math.max(40, (x2 - x1) * 0.5);
        c1x = x1 + dx; c1y = y1;
        c2x = x2 - dx; c2y = y2;
      } else {
        x1 = a.left + a.width / 2 - wrapBox.left;
        y1 = aBottom;
        x2 = b.left + b.width / 2 - wrapBox.left;
        y2 = bTop;
        const dy = Math.max(30, (y2 - y1) * 0.6);
        c1x = x1; c1y = y1 + dy;
        c2x = x2; c2y = y2 - dy;
      }
      out.push(`<path d="M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}"/>`);
    }
    svg.innerHTML = out.join('');
  }

  function bounceInPlace() {
    // Each node nudges outward from the canvas center, then snaps back.
    const wrapBox = wrap.getBoundingClientRect();
    const cx = wrapBox.width / 2;
    const cy = wrapBox.height / 2;
    nodes.forEach((n) => {
      const r = n.getBoundingClientRect();
      const nx = (r.left - wrapBox.left) + r.width / 2;
      const ny = (r.top - wrapBox.top) + r.height / 2;
      const vx = nx - cx;
      const vy = ny - cy;
      const len = Math.max(1, Math.hypot(vx, vy));
      const dx = (vx / len) * 14;
      const dy = (vy / len) * 14;
      n.style.transition = 'transform 160ms cubic-bezier(.3,.7,.4,1)';
      n.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    // Drive edge redraw during the bounce.
    const t0 = performance.now();
    const tick = () => {
      drawEdges();
      if (performance.now() - t0 < 360) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => {
      nodes.forEach((n) => { n.style.transform = ''; });
      setTimeout(() => {
        nodes.forEach((n) => { n.style.transition = ''; });
        drawEdges();
      }, 200);
    }, 160);
  }

  function isAtCanonical() {
    const targets = computeCanonicalTargets();
    return nodes.every((n, i) => n.style.left === targets[i].left && n.style.top === targets[i].top);
  }

  function resetLayout() {
    if (isAtCanonical()) { bounceInPlace(); return; }
    // Freeze edge sides at the current layout so the curves don't flip
    // mid-animation as nodes slide past each other.
    frozenEdgeSides = computeEdgeSides((n) => n.getBoundingClientRect());
    nodes.forEach((n) => n.classList.add('is-resetting'));
    layout();
    const dur = 420;
    const t0 = performance.now();
    const tick = () => {
      drawEdges();
      if (performance.now() - t0 < dur) requestAnimationFrame(tick);
      else {
        nodes.forEach((n) => n.classList.remove('is-resetting'));
        frozenEdgeSides = null;
        drawEdges();
      }
    };
    requestAnimationFrame(tick);
  }

  function shuffleSentence() {
    sentenceIdx = (sentenceIdx + 1) % SENTENCES.length;
    const next = SENTENCES[sentenceIdx];

    // Freeze edge sides until both word-swap AND position reset finish so
    // the side an edge leaves doesn't flip during animation.
    frozenEdgeSides = computeEdgeSides((n) => n.getBoundingClientRect());

    // Swap text in-place; shake on every node so the change reads even
    // when a slot's word didn't actually change. Shake uses `transform`
    // while the reset below animates `left/top`, so they share the
    // window without stepping on each other.
    nodes.forEach((n, i) => {
      const newWord = next[i];
      const current = wordEl(n);
      if (current && current.textContent.trim() !== newWord) current.textContent = newWord;
      n.classList.remove('is-shaking');
      void n.offsetWidth;
      n.classList.add('is-shaking');
      n.classList.add('is-resetting');
    });

    // Snake re-layout runs immediately so position changes happen in
    // parallel with the shake.
    layout();
    const SHAKE_DUR = 220;
    const RESET_DUR = 420;
    setTimeout(() => nodes.forEach((n) => n.classList.remove('is-shaking')), SHAKE_DUR);
    const t0 = performance.now();
    const tick = () => {
      drawEdges();
      if (performance.now() - t0 < RESET_DUR) requestAnimationFrame(tick);
      else {
        nodes.forEach((n) => n.classList.remove('is-resetting'));
        frozenEdgeSides = null;
        drawEdges();
      }
    };
    requestAnimationFrame(tick);
  }

  // Pointer-based drag. setPointerCapture on the node so move events keep
  // firing on the original target even if the cursor outpaces the element.
  let drag = null;
  nodes.forEach((n) => {
    n.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      const wrapBox = wrap.getBoundingClientRect();
      const r = n.getBoundingClientRect();
      const PAD = 24;
      const topnav = document.querySelector('.lp-topnav');
      const tabsEl = document.querySelector('.lp-tabs');
      const topnavBottom = topnav ? topnav.getBoundingClientRect().bottom : 0;
      const tabsTop = tabsEl ? tabsEl.getBoundingClientRect().top : window.innerHeight;
      drag = {
        node: n,
        offsetX: e.clientX - r.left,
        offsetY: e.clientY - r.top,
        wrapBox,
        minViewX: PAD,
        maxViewX: window.innerWidth - PAD - n.offsetWidth,
        minViewY: topnavBottom + PAD,
        maxViewY: tabsTop - PAD - n.offsetHeight
      };
      try { n.setPointerCapture(e.pointerId); } catch (_) {}
      n.classList.add('is-dragging');
    });
    n.addEventListener('pointermove', (e) => {
      if (!drag || drag.node !== n) return;
      const wrapBox = drag.wrapBox;
      const vx = e.clientX - drag.offsetX;
      const vy = e.clientY - drag.offsetY;
      const cx = Math.max(drag.minViewX, Math.min(drag.maxViewX, vx));
      const cy = Math.max(drag.minViewY, Math.min(drag.maxViewY, vy));
      n.style.left = `${cx - wrapBox.left}px`;
      n.style.top = `${cy - wrapBox.top}px`;
      drawEdges();
    });
    const end = (e) => {
      if (!drag || drag.node !== n) return;
      try { n.releasePointerCapture(e.pointerId); } catch (_) {}
      n.classList.remove('is-dragging');
      drag = null;
    };
    n.addEventListener('pointerup', end);
    n.addEventListener('pointercancel', end);
  });

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(layout, 80);
  });

  const AUTO_SHUFFLE_MS = 5000;
  let autoShuffleTimer = null;
  function armAutoShuffle() {
    clearTimeout(autoShuffleTimer);
    autoShuffleTimer = setTimeout(() => {
      shuffleSentence();
      armAutoShuffle();
    }, AUTO_SHUFFLE_MS);
  }

  // Wait for fonts so node widths are measured against the rendered text.
  const start = () => requestAnimationFrame(() => requestAnimationFrame(layout));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }

  // ── Toolbar wiring ──────────────────────────────────────
  const toolbar = document.getElementById('lpToolbar');
  if (toolbar) {
    // Theme tip text reflects the current state so the user knows what
    // clicking will do, not what the page is currently in.
    const themeTip = toolbar.querySelector('.lp-toolbar-tip--theme');
    const updateThemeTip = () => {
      if (!themeTip) return;
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeTip.textContent = dark ? 'Lights on' : 'Lights off';
    };
    updateThemeTip();

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.lp-toolbar-btn');
      if (!btn) return;
      const tool = btn.dataset.tool;
      if (tool === 'shuffle') {
        shuffleSentence();
        armAutoShuffle();
        return;
      }
      if (tool === 'reset') { resetLayout(); return; }
      if (tool === 'theme') {
        const html = document.documentElement;
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        if (next === 'dark') html.setAttribute('data-theme', 'dark');
        else html.removeAttribute('data-theme');
        try { localStorage.setItem('cfg.theme', next); } catch (_) {}
        updateThemeTip();
        document.dispatchEvent(new CustomEvent('lp-theme-changed'));
        return;
      }
    });
  }

  armAutoShuffle();
})();

/* ── Interactive Demos ─────────────────────────────────────
   Two modes:
     1. Auto-cycle (default on load) — a setTimeout fires when
        the current video finishes (duration*1000 ms after
        playback starts) and activates the next demo in ORDER.
        Videos keep `loop` ON the whole time so the same clip
        repeats if our timer's a touch late, AND so Chrome's
        autoplay policy lets the first one start muted without
        a user gesture. (`loop` is one of the signals Chrome
        uses to permit autoplay; without it the browser cuts
        playback short after ~1s in some sessions.)
     2. Manual (after user clicks any tab) — auto-cycle timer
        is cancelled. The clicked tab's video keeps looping.

   Memory: only the active video is playing; others are
   paused, and most start with `preload="none"` so we don't
   hold ~70MB of decoded frames in memory. First activation
   bumps preload so the browser fetches it. */
(() => {
  const tabs = document.querySelectorAll('.lp-demo-tab');
  const videos = document.querySelectorAll('.lp-demo-video');
  if (!tabs.length || !videos.length) return;

  // Order tabs cycle through. Matches the HTML tab order so
  // it reads as a natural authoring flow.
  const ORDER = [
    'add-node', 'make-connection', 'auto-type-adaptor',
    'autolayout', 'make-subgroup', 'make-path',
    'run-compare', 'version-history', 'fork-project',
  ];

  let userInteracted = false;
  let cycleTimer = null;

  function clearCycleTimer() {
    if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
  }

  // Schedule advance to the next demo. If the video doesn't
  // know its duration yet, wait for `loadedmetadata` first.
  function scheduleAdvance(v) {
    clearCycleTimer();
    if (userInteracted) return;
    const dur = v.duration;
    if (!isFinite(dur) || dur <= 0) {
      v.addEventListener('loadedmetadata', () => scheduleAdvance(v), { once: true });
      return;
    }
    cycleTimer = setTimeout(() => {
      if (userInteracted) return;
      const i = ORDER.indexOf(v.dataset.demo);
      const next = ORDER[(i + 1) % ORDER.length];
      activate(next);
    }, dur * 1000);
  }

  function activate(demo) {
    clearCycleTimer();
    tabs.forEach(t => {
      const on = t.dataset.demo === demo;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    let activeVid = null;
    videos.forEach(v => {
      const on = v.dataset.demo === demo;
      v.classList.toggle('active', on);
      if (on) {
        activeVid = v;
        // First-time activation: unlock preload so it actually
        // fetches. Subsequent times the browser uses its cache.
        if (v.preload === 'none') v.preload = 'auto';
        // Restart from the beginning so each cycle shows the
        // full demo, not whatever frame it was paused on.
        try { v.currentTime = 0; } catch (_) {}
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else {
        v.pause();
      }
    });
    if (activeVid && !userInteracted) scheduleAdvance(activeVid);
  }

  // If a video fails to load (network/codec), don't get stuck
  // on it — skip to the next one.
  videos.forEach(v => {
    v.addEventListener('error', () => {
      if (userInteracted || !v.classList.contains('active')) return;
      const i = ORDER.indexOf(v.dataset.demo);
      const next = ORDER[(i + 1) % ORDER.length];
      activate(next);
    });
  });

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      userInteracted = true;
      clearCycleTimer();
      activate(t.dataset.demo);
    });
  });

  // Kick off the first video. Autoplay needs muted+loop
  // (already set in HTML) — Chrome honors that combination.
  activate('add-node');
})();

/* ── Anchor links: smooth scroll to section ────────────────
   Native browser anchor-jump is blocked by `overflow: clip`
   on `.lp-main`, and `window.scrollTo({behavior:'smooth'})`
   is unreliable across browsers. We animate the scroll
   manually with rAF — guaranteed to work everywhere.

   Vertical offset (sticky topnav clearance) is computed
   from the topnav's actual height so it stays correct if
   the nav resizes (responsive). */
(() => {
  const topnav = document.querySelector('.lp-topnav');
  function navOffset() {
    return (topnav?.getBoundingClientRect().height || 64) + 16;
  }

  function smoothScrollTo(targetY, duration = 600) {
    const startY = window.scrollY;
    const dy = targetY - startY;
    if (Math.abs(dy) < 2) return;
    const t0 = performance.now();
    // easeInOutCubic — calm acceleration in, calm deceleration out.
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, startY + dy * ease(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (!href || href === '#') {
        e.preventDefault();
        return;
      }
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      history.pushState(null, '', href);
      const y = target.getBoundingClientRect().top + window.scrollY - navOffset();
      smoothScrollTo(y);
    });
  });

  /* ── Dev tour toggle ───────────────────────────────────────
     Reflects/edits the `cfg.tutorialState` localStorage key that the
     onboarding tutorial reads in graphs-hub / view-mode / editing-mode.
       ON  → state cleared, so next "Start building" begins a fresh tour.
       OFF → state.skipped = true, so the tour stays suppressed.
     The tour is considered ON by default (no state, or started+!skipped+!completed).
  */
  (function initTourToggle() {
    const btn = document.getElementById('lpTourToggle');
    if (!btn) return;
    const STATE_KEY = 'cfg.tutorialState';
    const labelEl = btn.querySelector('[data-tour-state]');

    function readState() {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    }

    function isTourEnabled() {
      const s = readState();
      // No state at all → tour is ON (default for first-time users).
      if (!s) return true;
      // Explicitly skipped or completed → tour is OFF.
      if (s.skipped || s.completed) return false;
      return true;
    }

    function paint(on) {
      btn.classList.toggle('on', on);
      btn.classList.toggle('off', !on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      if (labelEl) labelEl.textContent = on ? 'ON' : 'OFF';
      btn.title = on
        ? "Onboarding tour is ON — clicking 'Start building' will start the tour."
        : "Onboarding tour is OFF — the tour stays suppressed.";
    }

    function setEnabled(on) {
      try {
        if (on) {
          // Clear all state so the next visit auto-starts fresh.
          localStorage.removeItem(STATE_KEY);
        } else {
          // Mark as skipped to suppress auto-start. Keep currentStep so a
          // future re-enable can resume where the user left off if desired.
          const s = readState() || {};
          s.skipped = true;
          s.completed = false;
          s.lastActivity = Date.now();
          localStorage.setItem(STATE_KEY, JSON.stringify(s));
        }
      } catch (_) {}
      paint(on);
    }

    paint(isTourEnabled());
    btn.addEventListener('click', () => setEnabled(!isTourEnabled()));
  })();

  /* ── Pre-arm the tour on "Start building" ──────────────────
     The hub used to rely on `?new=1` in the URL to auto-start the tour, but
     some static-file servers (notably `npx serve` with clean-URLs) drop the
     query string when redirecting `/foo.html` → `/foo`. To make step 1 fire
     reliably regardless of URL rewriting, we write the tutorial state to
     localStorage BEFORE navigating away from landing. The hub's existing
     resume-on-load logic then picks it up and shows step 1 (its
     onBeforeShow self-heals by opening the New Graph modal if needed).
  */
  (function preArmTourOnStartBuilding() {
    const STATE_KEY = 'cfg.tutorialState';
    function readState() {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    }
    function tourOn() {
      const s = readState();
      if (!s) return true;
      return !(s.skipped || s.completed);
    }
    // Match any link/button that opens the New Graph modal — the landing
    // page has several copies of "Start building".
    const triggers = document.querySelectorAll(
      'a[href*="new=1"], [data-auth-action="signup"]'
    );
    triggers.forEach((el) => {
      el.addEventListener('click', () => {
        if (!tourOn()) return;
        try {
          localStorage.setItem(STATE_KEY, JSON.stringify({
            started: true,
            currentStep: 1,
            completedSteps: [],
            skipped: false,
            completed: false,
            lastActivity: Date.now(),
          }));
        } catch (_) {}
      });
    });
  })();
})();
