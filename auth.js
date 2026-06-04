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
 *   normalizeReturnUrl(raw, opts?)                 → string  (file://-safe relative app URL)
 *   relativePageUrl()                              → string
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
      avatar: u.avatar || '',
      bio: u.bio || '',
      createdAt: u.createdAt,
    };
  }

  // ── Profile updates (settings page) ───────────────────────────────
  // Patch fields on the current user's record. `avatar` is a data-URL
  // string (or null to clear). Passing `undefined` for any key leaves it
  // unchanged. Mirrors the display name into the onboarding profile so
  // displayName() — which prefers the onboarding name — stays in sync.
  function updateProfile(patch) {
    patch = patch || {};
    const s = readSession();
    if (!s) return null;
    const users = readUsers();
    const u = users[s.email];
    if (!u) return null;
    if (typeof patch.name === 'string') {
      const nm = patch.name.trim();
      if (nm) {
        u.name = nm;
        if (u.onboarding && u.onboarding.profile) u.onboarding.profile.name = nm;
      }
    }
    if (typeof patch.username === 'string') u.username = patch.username.trim();
    if (typeof patch.bio === 'string') u.bio = patch.bio;
    if (typeof patch.avatar === 'string') u.avatar = patch.avatar;
    else if (patch.avatar === null) delete u.avatar;
    writeUsers(users);
    notify('profile');
    return publicUser(u);
  }

  // ── Account: change email ─────────────────────────────────────────
  // Email is the primary key in the users map, so a change re-keys the
  // record and updates the session. Throws (with a `field`) on a bad
  // format or a collision with another account.
  async function changeEmail(newEmail) {
    const s = readSession();
    if (!s) throw new Error('Not signed in.');
    const next = normEmail(newEmail);
    const eV = validators.email(next);
    if (!eV.ok) throw Object.assign(new Error(eV.msg), { field: 'email' });
    const users = readUsers();
    const cur = users[s.email];
    if (!cur) throw new Error('Account not found.');
    if (next === s.email) return publicUser(cur);
    if (Object.prototype.hasOwnProperty.call(users, next)) {
      throw Object.assign(new Error('An account with that email already exists.'), { field: 'email' });
    }
    delete users[s.email];
    cur.email = next;
    users[next] = cur;
    writeUsers(users);
    writeSession({ email: next, since: s.since || new Date().toISOString() });
    notify('email');
    return publicUser(cur);
  }

  // ── Account: change password ──────────────────────────────────────
  // Verifies the current password, then re-hashes the new one with a
  // fresh salt. Throws (with a `field`) on a wrong current password or
  // a new password that fails the format check.
  async function changePassword({ currentPassword, newPassword } = {}) {
    const s = readSession();
    if (!s) throw new Error('Not signed in.');
    const users = readUsers();
    const u = users[s.email];
    if (!u) throw new Error('Account not found.');
    const curHash = await hashPassword(String(currentPassword || ''), u.salt);
    if (!safeEqual(curHash, u.hash)) {
      throw Object.assign(new Error('Current password is incorrect.'), { field: 'current' });
    }
    const pV = validators.password(newPassword);
    if (!pV.ok) throw Object.assign(new Error(pV.msg), { field: 'new' });
    const salt = randomSaltHex();
    u.salt = salt;
    u.hash = await hashPassword(String(newPassword), salt);
    writeUsers(users);
    notify('password');
    return true;
  }

  // ── Account: delete ───────────────────────────────────────────────
  // Removes the current user's record and clears the session. The UI is
  // responsible for confirming first and redirecting afterwards.
  function deleteAccount() {
    const s = readSession();
    if (!s) return false;
    const users = readUsers();
    if (users[s.email]) {
      delete users[s.email];
      writeUsers(users);
    }
    writeSession(null);
    notify('logout');
    return true;
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
    const profileName = answers?.profile?.name;
    if (profileName && String(profileName).trim()) {
      u.name = String(profileName).trim();
    }
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

  // ── Return URL helpers (file://-safe) ─────────────────────────────
  // Under file://, location.pathname is an absolute filesystem path. Passing
  // that through URL() and stripping one leading slash produces a bogus
  // relative URL that doubles the directory when assigned to location.href.
  function relativePageUrl() {
    const file = location.pathname.split('/').filter(Boolean).pop();
    return (file || 'index.html') + location.search + location.hash;
  }
  function ensureNewParam(url) {
    if (/[?&]new=/.test(url)) return url;
    return url + (url.includes('?') ? '&' : '?') + 'new=1';
  }
  function normalizeReturnUrl(raw, opts) {
    opts = opts || {};
    const fallback = opts.fallback || 'graphs-hub.html?tab=dashboard&new=1';
    let s = String(raw || '').trim();
    if (!s) s = fallback;
    if (/(^|\/)(auth|onboarding)\.html/i.test(s)) {
      s = fallback;
    } else if (/^file:/i.test(s)) {
      try {
        const u = new URL(s);
        const file = u.pathname.split('/').filter(Boolean).pop() || 'graphs-hub.html';
        s = file + u.search + u.hash;
      } catch (_) { s = fallback; }
    } else if (s.charAt(0) === '/' && /\.html/i.test(s)) {
      const qIdx = s.indexOf('?');
      const hIdx = s.indexOf('#');
      const cut = Math.min(
        qIdx >= 0 ? qIdx : s.length,
        hIdx >= 0 ? hIdx : s.length
      );
      const file = s.slice(0, cut).split('/').filter(Boolean).pop() || 'graphs-hub.html';
      s = file + s.slice(cut);
    } else if (/^https?:/i.test(s)) {
      try {
        const u = new URL(s);
        const file = u.pathname.split('/').filter(Boolean).pop() || 'graphs-hub.html';
        s = file + u.search + u.hash;
      } catch (_) { s = fallback; }
    }
    if (opts.ensureNew) s = ensureNewParam(s);
    return s;
  }

  // ── Navigation helper ─────────────────────────────────────────────
  // `view` is 'signup' (default) or 'login'. `returnTo` is the URL we
  // bounce back to after success; if omitted we use the current location.
  function navigateToAuth(view, returnTo) {
    const v = view === 'login' ? 'login' : 'signup';
    const ret = normalizeReturnUrl(returnTo, { fallback: relativePageUrl() });
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
    const src = displayName(user).trim();
    return src.charAt(0).toUpperCase() || '?';
  }
  function emailLocalPart(email) {
    const e = normEmail(email);
    const at = e.indexOf('@');
    return at > 0 ? e.slice(0, at) : e;
  }
  function displayName(user) {
    if (!user) return '';
    const raw = getCurrentUserRaw();
    const obName = raw?.onboarding?.profile?.name;
    if (obName && String(obName).trim()) return String(obName).trim();
    const name = String(user.name || '').trim();
    if (name) return name;
    return emailLocalPart(user.email);
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
        overflow: hidden;
      }
      .leftnav-auth .la-avatar-img {
        width: 100%; height: 100%;
        object-fit: cover; border-radius: 50%; display: block;
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

      body.sidebar-expanded .leftnav-auth.is-user .la-stack,
      .app.leftnav-expanded .leftnav-auth.is-user .la-stack {
        display: flex;
      }
      body:not(.sidebar-expanded):not(:has(.app)) .leftnav-auth .la-stack,
      .app:not(.leftnav-expanded) .leftnav-auth .la-stack { display: none; }
      body:not(.sidebar-expanded):not(:has(.app)) .leftnav-auth.is-user,
      .app:not(.leftnav-expanded) .leftnav-auth.is-user {
        padding: 4px;
        gap: 0;
      }

      /* Landing page topnav — logged-in avatar chip */
      .lp-auth-chip.is-user {
        padding: 4px;
        background: transparent;
        border: none;
        color: var(--lp-text, var(--text-primary, #0f172a));
      }
      .lp-auth-chip.is-user:hover {
        background: var(--lp-bg-soft, var(--bg, #f8fafc));
        border: none;
      }
      .lp-auth-chip .la-avatar {
        flex: 0 0 auto;
        width: 28px; height: 28px;
        border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        color: #fff;
        font-size: 12px; font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        overflow: hidden;
      }
      .lp-auth-chip .la-avatar-img {
        width: 100%; height: 100%;
        object-fit: cover; border-radius: 50%; display: block;
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
      .am-menu-sep { height: 1px; background: var(--border, #e5e7eb); margin: 4px 0; }

      /* Shared confirm modal (e.g. log out) */
      .cf-confirm-back {
        position: fixed; inset: 0; z-index: 99500;
        background: rgba(15, 23, 42, 0.45);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
      }
      .cf-confirm-card {
        width: 100%; max-width: 360px;
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 14px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.30);
        padding: 22px;
      }
      .cf-confirm-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #0f172a); }
      .cf-confirm-body { margin-top: 7px; font-size: 13px; line-height: 1.5; color: var(--text-secondary, #475569); }
      .cf-confirm-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
      .cf-confirm-btn {
        height: 36px; padding: 0 16px; border-radius: 8px;
        font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
        border: 1px solid var(--border, #e5e7eb);
        background: var(--surface, #fff); color: var(--text-primary, #0f172a);
      }
      .cf-confirm-btn:hover { background: var(--bg, #f1f5f9); }
      .cf-confirm-btn.danger { background: #dc2626; border-color: #dc2626; color: #fff; }
      .cf-confirm-btn.danger:hover { background: #b91c1c; border-color: #b91c1c; }
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

  // Lightweight promise-based confirm modal (shared across pages since
  // auth.js loads everywhere). Resolves true on confirm, false otherwise.
  function showConfirm(opts) {
    opts = opts || {};
    ensureChipStyles();
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'cf-confirm-back';
      back.innerHTML = `
        <div class="cf-confirm-card" role="dialog" aria-modal="true">
          <h3 class="cf-confirm-title"></h3>
          <p class="cf-confirm-body"></p>
          <div class="cf-confirm-actions">
            <button type="button" class="cf-confirm-btn cf-confirm-cancel"></button>
            <button type="button" class="cf-confirm-btn cf-confirm-ok"></button>
          </div>
        </div>`;
      back.querySelector('.cf-confirm-title').textContent = opts.title || 'Are you sure?';
      back.querySelector('.cf-confirm-body').textContent = opts.body || '';
      const okBtn = back.querySelector('.cf-confirm-ok');
      const cancelBtn = back.querySelector('.cf-confirm-cancel');
      okBtn.textContent = opts.confirmLabel || 'Confirm';
      cancelBtn.textContent = opts.cancelLabel || 'Cancel';
      if (opts.danger) okBtn.classList.add('danger');
      function done(v) {
        back.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') done(false); }
      okBtn.addEventListener('click', () => done(true));
      cancelBtn.addEventListener('click', () => done(false));
      back.addEventListener('mousedown', (e) => { if (e.target === back) done(false); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(back);
      okBtn.focus();
    });
  }

  const SETTINGS_URL = 'graphs-hub.html?tab=settings';

  // Pages where a guest has no meaningful access — editing a graph requires
  // login, onboarding is part of the signup flow. After logging out from one
  // of these pages we bounce to the login tab with the email pre-filled and
  // a `return=` so the user lands back here once they log back in.
  const PRIVATE_PAGE_NAMES = new Set(['editing-mode-new', 'onboarding']);

  function logoutNavigate(email) {
    const rawFile = location.pathname.split('/').filter(Boolean).pop() || '';
    const pageName = rawFile.replace(/\.html$/i, '').toLowerCase();

    if (PRIVATE_PAGE_NAMES.has(pageName)) {
      // Store the email in sessionStorage so auth.html can pre-fill it even
      // when static-file servers strip query params during the .html→clean-
      // URL redirect (e.g. `npx serve` redirects auth.html?… → /auth sans params).
      // auth.html reads this key on boot and removes it immediately.
      if (email) {
        try { sessionStorage.setItem('cfg.auth.loginPrefill', email); } catch (_) {}
      }
      // Still pass the params in the URL for production environments (GitHub
      // Pages) where .html redirects don't strip query strings.
      let url = 'auth.html?view=login';
      if (email) url += '&prefill=' + encodeURIComponent(email);
      url += '&return=' + encodeURIComponent(relativePageUrl());
      location.href = url;
    } else {
      // All other pages (landing, hub, community, public view-mode, etc.)
      // render fine for guests — just reload to drop the logged-in state.
      location.reload();
    }
  }

  function openUserMenu(anchor) {
    closeUserMenu();
    const user = getCurrentUser();
    if (!user) return;
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'am-menu open';
    menu.innerHTML = `
      <div class="am-menu-head">
        <div class="am-menu-name">${escapeHtml(displayName(user))}</div>
        <div class="am-menu-email">${escapeHtml(user.email)}</div>
      </div>
      <button type="button" class="am-menu-item" data-action="settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Settings
      </button>
      <div class="am-menu-sep"></div>
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

    menu.querySelector('[data-action="settings"]').addEventListener('click', () => {
      closeUserMenu();
      location.href = SETTINGS_URL;
    });
    menu.querySelector('[data-action="logout"]').addEventListener('click', async () => {
      closeUserMenu();
      const ok = await showConfirm({
        title: 'Log out?',
        body: "You'll be signed out of your account.",
        confirmLabel: 'Log out',
        cancelLabel: 'Cancel',
        danger: true,
      });
      if (!ok) return;
      const email = user && user.email;
      logout();
      logoutNavigate(email);
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
      const display = displayName(user);
      btn.title = `${display} — account menu`;
      const avatarInner = user.avatar
        ? `<img class="la-avatar-img" src="${escapeHtml(user.avatar)}" alt="" />`
        : escapeHtml(avatarLetter(user));
      const avatarBg = user.avatar ? 'transparent' : colorForKey(user.email);
      btn.innerHTML = `
        <span class="la-avatar" style="background:${avatarBg}">${avatarInner}</span>
        <span class="la-stack">
          <span class="la-name" title="${escapeHtml(display)}">${escapeHtml(display)}</span>
          <span class="la-email" title="${escapeHtml(user.email)}">${escapeHtml(user.email)}</span>
        </span>
      `;
    }
  }

  function renderLandingAuthChip() {
    const btn = document.getElementById('lpLoginBtn');
    if (!btn) return;
    ensureChipStyles();
    const user = getCurrentUser();
    if (!user) {
      btn.className = 'lp-btn lp-btn-ghost';
      btn.textContent = 'Log in / Sign up';
      btn.title = '';
      btn.setAttribute('aria-label', 'Log in or sign up');
      return;
    }
    const display = displayName(user);
    btn.className = 'lp-btn lp-btn-ghost lp-auth-chip is-user';
    btn.title = `${display} — account menu`;
    btn.setAttribute('aria-label', `Signed in as ${display}. Open account menu.`);
    const avatarInner = user.avatar
      ? `<img class="la-avatar-img" src="${escapeHtml(user.avatar)}" alt="" />`
      : escapeHtml(avatarLetter(user));
    const avatarBg = user.avatar ? 'transparent' : colorForKey(user.email);
    btn.innerHTML = `<span class="la-avatar" style="background:${avatarBg}">${avatarInner}</span>`;
  }

  let landingWired = false;
  function wireLandingAuth() {
    const btn = document.getElementById('lpLoginBtn');
    if (!btn) return;
    renderLandingAuthChip();
    if (landingWired) return;
    landingWired = true;
    btn.addEventListener('click', (e) => {
      if (isLoggedIn()) {
        e.preventDefault();
        e.stopPropagation();
        if (userMenuEl) closeUserMenu();
        else openUserMenu(btn);
      } else {
        e.preventDefault();
        navigateToAuth('login');
      }
    });
    onChange(() => {
      renderLandingAuthChip();
      closeUserMenu();
    });
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
        navigateToAuth('signup');
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
    updateProfile,
    changeEmail,
    changePassword,
    deleteAccount,
    showConfirm,
    getCurrentUser,
    isLoggedIn,
    isEmailTaken,
    isUsernameTaken,
    validators,
    onChange,
    navigateToAuth,
    wireLeftnavAuth,
    wireLandingAuth,
    renderLeftnavChip,
    renderLandingAuthChip,
    setOnboarding,
    getOnboarding,
    hasCompletedOnboarding,
    normalizeReturnUrl,
    relativePageUrl,
  };
})(window);
