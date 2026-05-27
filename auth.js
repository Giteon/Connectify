/*
 * auth.js — Client-side accounts for ConnectifyAI.
 *
 * Demo-grade authentication: everything lives in the browser's localStorage.
 * No backend, no network. Passwords are hashed with PBKDF2 (Web Crypto API,
 * 150k iterations, 16-byte random salt, SHA-256, 256-bit derived key) so the
 * raw password is never persisted — but treat this as a UX placeholder, not
 * real security. Anyone with devtools access can read the user record.
 *
 * The login/sign-up UI lives in a dedicated page (auth.html). This module
 * only exposes the core API plus a few helpers shared by auth.html and the
 * leftnav chip rendering — no modal/popover UI lives here.
 *
 * Storage keys
 *   auth.users     — JSON map keyed by lowercased email:
 *                    { [email]: { email, username, name, salt, hash, createdAt } }
 *   auth.session   — JSON: { email, since } — the currently-logged-in user
 *
 * Public surface (window.ConnectifyAuth):
 *   signup({ email, username, password, name? })  → Promise<user>
 *   login({ identifier, password })               → Promise<user>
 *      identifier: email OR username
 *   logout()                                       → void
 *   getCurrentUser()                              → user | null
 *   isLoggedIn()                                   → boolean
 *   isEmailTaken(email)                            → boolean
 *   isUsernameTaken(username)                      → boolean
 *   validators                                     → { email, username, password }
 *   onChange(fn)                                   → unsubscribe fn   (fires on login/logout)
 *   wireLeftnavAuth()                              → void   (renders chip, click → auth.html / menu)
 *   renderLeftnavChip()                            → void
 *   navigateToAuth(view, returnTo)                 → void
 *
 * Custom event: document dispatches 'connectify-auth-change' on login/logout.
 */
(function(global) {
  'use strict';

  const USERS_KEY = 'auth.users';
  const SESSION_KEY = 'auth.session';
  const PBKDF2_ITERATIONS = 150000;
  const AUTH_PAGE = 'auth.html';

  // ── Storage helpers ───────────────────────────────────────────────
  function readUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (_) { return {}; }
  }
  function writeUsers(map) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(map)); }
    catch (_) { /* quota */ }
  }
  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && obj.email ? obj : null;
    } catch (_) { return null; }
  }
  function writeSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  // ── Crypto: PBKDF2 over Web Crypto API ────────────────────────────
  function bytesToHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function randomSaltHex(bytes = 16) {
    const u = new Uint8Array(bytes);
    crypto.getRandomValues(u);
    return bytesToHex(u.buffer);
  }
  async function hashPassword(password, saltHex) {
    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API not available in this browser.');
    }
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(password),
      { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      key, 256
    );
    return bytesToHex(bits);
  }
  function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // ── Validators ────────────────────────────────────────────────────
  // Each validator returns { ok: boolean, msg: string }. Uniqueness lives
  // in isEmailTaken / isUsernameTaken so the UI can layer them after the
  // format checks pass.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const USERNAME_RE = /^[a-z0-9_-]+$/i;

  function normEmail(e) { return String(e || '').trim().toLowerCase(); }
  function normUsername(u) { return String(u || '').trim(); }

  const validators = {
    email(value) {
      const v = normEmail(value);
      if (!v) return { ok: false, msg: 'Email is required.' };
      if (!EMAIL_RE.test(v)) return { ok: false, msg: 'Enter a valid email address.' };
      if (v.length > 254) return { ok: false, msg: 'Email is too long.' };
      return { ok: true, msg: 'Looks good.' };
    },
    username(value) {
      const v = normUsername(value);
      if (!v) return { ok: false, msg: 'Username is required.' };
      if (v.length < 3) return { ok: false, msg: 'At least 3 characters.' };
      if (v.length > 30) return { ok: false, msg: 'Max 30 characters.' };
      if (!USERNAME_RE.test(v)) return { ok: false, msg: 'Letters, numbers, _ and - only.' };
      return { ok: true, msg: 'Looks good.' };
    },
    password(value) {
      const v = String(value || '');
      if (!v) return { ok: false, msg: 'Password is required.', strength: 0 };
      if (v.length < 8) return { ok: false, msg: 'At least 8 characters.', strength: 0 };
      // Bonus signal: encourage variety. Doesn't fail the check; the UI
      // can render a strength hint based on the returned `strength` score (0–5).
      let strength = 0;
      if (v.length >= 8) strength++;
      if (v.length >= 12) strength++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) strength++;
      if (/[0-9]/.test(v)) strength++;
      if (/[^A-Za-z0-9]/.test(v)) strength++;
      const msg = strength >= 4 ? 'Strong password.'
                : strength >= 3 ? 'Good password.'
                : 'Acceptable — consider adding numbers or symbols.';
      return { ok: true, msg, strength };
    },
  };

  function isEmailTaken(email) {
    const v = normEmail(email);
    if (!v) return false;
    const users = readUsers();
    return Object.prototype.hasOwnProperty.call(users, v);
  }
  function isUsernameTaken(username) {
    const v = normUsername(username).toLowerCase();
    if (!v) return false;
    const users = readUsers();
    for (const key in users) {
      const u = users[key];
      if (u && u.username && u.username.toLowerCase() === v) return true;
    }
    return false;
  }

  // ── Public user shape (no hash leaks out) ─────────────────────────
  function publicUser(u) {
    if (!u) return null;
    return {
      email: u.email,
      username: u.username || '',
      name: u.name || u.username || u.email,
      createdAt: u.createdAt,
    };
  }

  // ── Change listeners ──────────────────────────────────────────────
  const listeners = new Set();
  function notify(reason) {
    const user = getCurrentUser();
    listeners.forEach(fn => { try { fn(user, reason); } catch (_) {} });
    try {
      document.dispatchEvent(new CustomEvent('connectify-auth-change', {
        detail: { user, reason }
      }));
    } catch (_) {}
  }
  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // ── Core API ──────────────────────────────────────────────────────
  // Signup requires only email + password. `username` and `name` are
  // accepted for forward-compat but optional — if omitted, `name`
  // falls back to the local-part of the email (e.g. "jane" from
  // "jane@example.com").
  async function signup({ email, password, username, name }) {
    email = normEmail(email);
    username = normUsername(username);
    const eV = validators.email(email);
    if (!eV.ok) throw Object.assign(new Error(eV.msg), { field: 'email' });
    const pV = validators.password(password);
    if (!pV.ok) throw Object.assign(new Error(pV.msg), { field: 'password' });

    // Username is only validated if provided. Same for uniqueness.
    if (username) {
      const uV = validators.username(username);
      if (!uV.ok) throw Object.assign(new Error(uV.msg), { field: 'username' });
      if (isUsernameTaken(username)) {
        throw Object.assign(new Error('That username is taken.'), { field: 'username' });
      }
    }
    if (isEmailTaken(email)) {
      throw Object.assign(new Error('An account with that email already exists.'), { field: 'email' });
    }

    // Auto-derive display name from the email's local part if the
    // caller didn't supply one. Keeps the leftnav chip / user menu
    // from showing a bare email everywhere.
    const fallbackName = email.split('@')[0] || email;
    name = String(name || '').trim() || username || fallbackName;

    const salt = randomSaltHex();
    const hash = await hashPassword(password, salt);
    const user = {
      email,
      username: username || '',
      name,
      salt, hash,
      createdAt: new Date().toISOString(),
    };
    const users = readUsers();
    users[email] = user;
    writeUsers(users);

    writeSession({ email, since: new Date().toISOString() });
    notify('signup');
    return publicUser(user);
  }

  // ── Onboarding ────────────────────────────────────────────────────
  // Tiny convenience helpers around the user record. The onboarding
  // questionnaire saves answers here; downstream surfaces can read
  // them to tailor the experience.
  function setOnboarding(answers) {
    const s = readSession();
    if (!s) return false;
    const users = readUsers();
    const u = users[s.email];
    if (!u) return false;
    u.onboarding = Object.assign({}, u.onboarding || {}, answers || {}, {
      completedAt: new Date().toISOString(),
    });
    writeUsers(users);
    return true;
  }
  function getOnboarding() {
    const u = getCurrentUserRaw();
    return (u && u.onboarding) ? u.onboarding : null;
  }
  function getCurrentUserRaw() {
    const s = readSession();
    if (!s) return null;
    const users = readUsers();
    return users[s.email] || null;
  }
  function hasCompletedOnboarding() {
    const o = getOnboarding();
    return !!(o && o.completedAt);
  }

  // Login by email OR username.
  async function login({ identifier, password }) {
    const id = String(identifier || '').trim();
    if (!id) throw Object.assign(new Error('Email or username is required.'), { field: 'identifier' });
    if (!password) throw Object.assign(new Error('Password is required.'), { field: 'password' });

    const users = readUsers();
    let userKey = null;
    if (id.includes('@')) {
      const e = id.toLowerCase();
      if (users[e]) userKey = e;
    } else {
      const uname = id.toLowerCase();
      for (const k in users) {
        if (users[k] && users[k].username && users[k].username.toLowerCase() === uname) {
          userKey = k;
          break;
        }
      }
    }
    if (!userKey) {
      throw Object.assign(new Error('No account found for that email or username.'), { field: 'identifier' });
    }
    const u = users[userKey];
    const hash = await hashPassword(password, u.salt);
    if (!safeEqual(hash, u.hash)) {
      throw Object.assign(new Error('Incorrect password.'), { field: 'password' });
    }
    writeSession({ email: u.email, since: new Date().toISOString() });
    notify('login');
    return publicUser(u);
  }

  function logout() {
    writeSession(null);
    notify('logout');
  }

  function getCurrentUser() {
    const s = readSession();
    if (!s) return null;
    const users = readUsers();
    const u = users[s.email];
    return u ? publicUser(u) : null;
  }
  function isLoggedIn() { return !!getCurrentUser(); }

  // ── Navigation helper ─────────────────────────────────────────────
  // `view` is 'login' (default) or 'signup'. `returnTo` is the URL we
  // bounce back to after success; if omitted we use the current location.
  function navigateToAuth(view, returnTo) {
    const v = view === 'signup' ? 'signup' : 'login';
    const ret = returnTo || (location.pathname + location.search + location.hash);
    const url = `${AUTH_PAGE}?view=${v}&return=${encodeURIComponent(ret)}`;
    location.href = url;
  }

  // ── Leftnav chip ──────────────────────────────────────────────────
  // Drop-in replacement for the #leftnavAuth button. Logged-out → CTA;
  // logged-in → avatar + name + email with a click-to-open menu (Log out).
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function colorForKey(key) {
    let h = 0;
    const s = String(key || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360}, 65%, 48%)`;
  }
  function avatarLetter(user) {
    const src = (user.name || user.username || user.email || '?').trim();
    return src.charAt(0).toUpperCase() || '?';
  }

  // Inject leftnav-chip-only styles (the auth page brings its own CSS).
  const CHIP_STYLE_ID = 'connectify-auth-chip-style';
  function ensureChipStyles() {
    if (document.getElementById(CHIP_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CHIP_STYLE_ID;
    style.textContent = `
      .leftnav-auth.is-user {
        background: var(--bg, #f1f5f9);
        border-color: var(--border, #e5e7eb);
        color: var(--text-primary, #0f172a);
        gap: 10px;
        padding: 7px 10px;
        overflow: hidden;
      }
      .leftnav-auth.is-user:hover {
        background: var(--surface-hover, var(--bg, #f1f5f9));
        border-color: var(--border-strong, var(--border, #d1d5db));
        opacity: 1;
      }
      .leftnav-auth .la-avatar {
        flex: 0 0 auto;
        width: 24px; height: 24px;
        border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        color: #fff;
        font-size: 11px; font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      /* min-width:0 is what lets the inner ellipsis kick in — without it
         a flex child grows to fit its longest line and pushes past the
         chip's edge instead of truncating. */
      .leftnav-auth .la-stack {
        display: flex; flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        line-height: 1.15;
        flex: 1 1 0;
        min-width: 0;
        text-align: left;
      }
      .leftnav-auth .la-name,
      .leftnav-auth .la-email {
        display: block;
        width: 100%;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .leftnav-auth .la-name { font-size: 12.5px; font-weight: 600; }
      .leftnav-auth .la-email {
        font-size: 10.5px; font-weight: 500;
        color: var(--text-muted, #64748b);
      }
      body:not(.sidebar-expanded) .leftnav-auth .la-stack,
      .app:not(.leftnav-expanded) .leftnav-auth .la-stack { display: none; }
      body:not(.sidebar-expanded) .leftnav-auth.is-user,
      .app:not(.leftnav-expanded) .leftnav-auth.is-user {
        padding: 4px;
        gap: 0;
      }

      /* User menu popover (Log out) */
      .am-menu {
        position: fixed;
        z-index: 99400;
        min-width: 200px;
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 10px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
        padding: 6px;
        display: none;
      }
      .am-menu.open { display: block; }
      .am-menu-head {
        padding: 8px 10px 10px;
        border-bottom: 1px solid var(--border, #e5e7eb);
        margin-bottom: 4px;
      }
      .am-menu-name {
        font-size: 13px; font-weight: 600;
        color: var(--text-primary, #0f172a);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        max-width: 180px;
      }
      .am-menu-email {
        font-size: 11.5px; color: var(--text-muted, #64748b);
        margin-top: 1px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        max-width: 180px;
      }
      .am-menu-item {
        appearance: none;
        width: 100%;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 10px;
        background: transparent; border: none;
        color: var(--text-primary, #0f172a);
        font: inherit; font-size: 13px; text-align: left;
        border-radius: 6px;
        cursor: pointer;
      }
      .am-menu-item:hover { background: var(--bg, #f1f5f9); }
      .am-menu-item.danger { color: #dc2626; }
      .am-menu-item.danger:hover { background: rgba(220, 38, 38, 0.08); }
      .am-menu-item svg { width: 15px; height: 15px; flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  }

  let userMenuEl = null;
  function closeUserMenu() {
    if (userMenuEl) {
      userMenuEl.remove();
      userMenuEl = null;
      document.removeEventListener('click', onDocClickForMenu, true);
      document.removeEventListener('keydown', onMenuKey);
    }
  }
  function onDocClickForMenu(e) {
    if (!userMenuEl) return;
    if (userMenuEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#leftnavAuth')) return;
    closeUserMenu();
  }
  function onMenuKey(e) { if (e.key === 'Escape') closeUserMenu(); }

  function openUserMenu(anchor) {
    closeUserMenu();
    const user = getCurrentUser();
    if (!user) return;
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'am-menu open';
    menu.innerHTML = `
      <div class="am-menu-head">
        <div class="am-menu-name">${escapeHtml(user.name || user.username || user.email)}</div>
        <div class="am-menu-email">${escapeHtml(user.email)}</div>
      </div>
      <button type="button" class="am-menu-item danger" data-action="logout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Log out
      </button>
    `;
    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    const left = Math.min(window.innerWidth - menuRect.width - 8, Math.max(8, rect.left));
    const top = Math.max(8, rect.top - menuRect.height - 8);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    userMenuEl = menu;

    menu.querySelector('[data-action="logout"]').addEventListener('click', () => {
      logout();
      closeUserMenu();
    });
    setTimeout(() => {
      document.addEventListener('click', onDocClickForMenu, true);
      document.addEventListener('keydown', onMenuKey);
    }, 0);
  }

  function renderLeftnavChip() {
    const btn = document.getElementById('leftnavAuth');
    if (!btn) return;
    ensureChipStyles();
    const user = getCurrentUser();
    if (!user) {
      btn.classList.remove('is-user');
      btn.title = 'Log in or sign up';
      btn.innerHTML = `
        <svg class="la-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        <span class="la-label">Log in / Sign up</span>
      `;
    } else {
      btn.classList.add('is-user');
      btn.title = `${user.name || user.username || user.email} — account menu`;
      const display = user.name || user.username || user.email;
      btn.innerHTML = `
        <span class="la-avatar" style="background:${colorForKey(user.email)}">${escapeHtml(avatarLetter(user))}</span>
        <span class="la-stack">
          <span class="la-name" title="${escapeHtml(display)}">${escapeHtml(display)}</span>
          <span class="la-email" title="${escapeHtml(user.email)}">${escapeHtml(user.email)}</span>
        </span>
      `;
    }
  }

  let leftnavWired = false;
  function wireLeftnavAuth() {
    const btn = document.getElementById('leftnavAuth');
    if (!btn) return;
    ensureChipStyles();
    renderLeftnavChip();
    if (leftnavWired) return;
    leftnavWired = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isLoggedIn()) {
        if (userMenuEl) closeUserMenu();
        else openUserMenu(btn);
      } else {
        navigateToAuth('login');
      }
    });
    onChange(() => {
      renderLeftnavChip();
      closeUserMenu();
    });
  }

  // ── Public surface ────────────────────────────────────────────────
  global.ConnectifyAuth = {
    signup,
    login,
    logout,
    getCurrentUser,
    isLoggedIn,
    isEmailTaken,
    isUsernameTaken,
    validators,
    onChange,
    navigateToAuth,
    wireLeftnavAuth,
    renderLeftnavChip,
    setOnboarding,
    getOnboarding,
    hasCompletedOnboarding,
  };
})(window);
