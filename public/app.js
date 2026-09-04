/* ============================================================
   frfr — make frens in ur city ✦
   ============================================================ */
'use strict';

/* ------------------------------------------------------------ helpers */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const fx = $('#fx');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function timeAgo(t) {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h';
  const d = Math.floor(h / 24); if (d < 7) return d + 'd';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function clockTime(t) {
  return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function gradCss(meta, i) {
  const g = meta.grads[i % meta.grads.length];
  return `linear-gradient(135deg, ${g.from}, ${g.to})`;
}

/* ------------------------------------------------------------ state */
const state = {
  token: localStorage.getItem('frfr_token') || null,
  user: null,
  meta: null,
  likesReceived: 0,
  matchesCount: 0,
  deck: [],
  swiping: false,
  view: 'deck',          // deck | matches | profile | admin
  activeMatch: null,     // match object when in chat
  chatTimer: null,
  muted: localStorage.getItem('frfr_muted') === '1'
};

const sfxHappy = $('#sfx-happy');
const sfxOhno = $('#sfx-ohno');
[sfxHappy, sfxOhno].forEach(a => a.addEventListener('error', () => { a.dataset.broken = '1'; }, true));
function playSfx(kind) {
  if (state.muted) return;
  const el = kind === 'happy' ? sfxHappy : sfxOhno;
  if (el.dataset.broken) return;
  try { el.currentTime = 0; el.volume = kind === 'happy' ? 0.9 : 0.95; el.play().catch(() => {}); } catch {}
}

/* ------------------------------------------------------------ api */
async function api(path, opts = {}) {
  const headers = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && state.token && path !== '/api/login') {
      // session died — back to landing
      localStorage.removeItem('frfr_token');
      state.token = null; state.user = null;
      renderLanding();
    }
    const e = new Error((data && data.error) || 'something broke 💀');
    e.status = res.status;
    throw e;
  }
  return data;
}

/* ------------------------------------------------------------ toasts */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ------------------------------------------------------------ confetti */
function confetti(n = 70) {
  const colors = ['#ccff33', '#5eead4', '#ff4d8d', '#a78bfa', '#fbbf24', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    const size = 5 + Math.random() * 8;
    c.style.cssText = `left:${Math.random() * 100}vw;width:${size}px;height:${size * (Math.random() > .5 ? 1 : 2.2)}px;
      background:${colors[i % colors.length]};animation-duration:${2.2 + Math.random() * 2}s;
      animation-delay:${Math.random() * .5}s;border-radius:${Math.random() > .5 ? '50%' : '2px'};`;
    fx.appendChild(c);
    setTimeout(() => c.remove(), 5200);
  }
}

/* ------------------------------------------------------------ avatar html */
function avatarHtml(u, cls = '') {
  return `<div class="avatar ${cls}" style="background:${gradCss(state.meta, u.avatar.grad)}" title="${esc(u.name)}">${esc(u.avatar.emoji)}</div>`;
}

/* ============================================================
   LANDING / AUTH
   ============================================================ */
let authTab = 'login';
let draft = { emoji: '😎', grad: 0, vibes: [] }; // signup form draft (avatar/vibes picks)

function renderLanding() {
  stopTimers();
  const m = state.meta;
  const st = m ? m.stats : { frens: 0, cities: 0 };
  app.innerHTML = `
  <div class="landing">
    <div class="landing-inner">
      <div class="hero">
        <div class="logo-big">frfr<span class="dot">.</span></div>
        <p class="tagline">make <b>frens</b> in ur city. swipe right on the vibes, <b>match</b>, and start yapping. <b>no cap.</b> 📍India</p>
        <div class="hero-chips">
          <span class="hchip hot">🔥 ${st.frens}+ frens vibing</span>
          <span class="hchip">📍 ${st.cities}+ cities</span>
          <span class="hchip">🛡️ teens only (13-19)</span>
        </div>
      </div>
      <div class="hero-side">
        <div class="auth-card" id="auth-card"></div>
      </div>
    </div>
        <div class="marquee"><span>make frens in ur city ★ swipe right ★ it's a match ★ no cap ★ vibe check passed ★ fr fr ★ lowkey iconic ★ bestie behaviour ★&nbsp;make frens in ur city ★ swipe right ★ it's a match ★ no cap ★ vibe check passed ★ fr fr ★ lowkey iconic ★ bestie behaviour ★&nbsp;</span></div>
        <div class="ver-tag">v1.5 ✦ if u can read this, u got the newest build</div>
  </div>`;
  renderAuthCard();
}

function renderAuthCard() {
  const card = $('#auth-card');
  const isLogin = authTab === 'login';
  card.innerHTML = `
    <h2 class="auth-title">${isLogin ? 'welcome back bestie 😎' : 'join the vibe ✨'}</h2>
    <p class="auth-sub">${isLogin ? 'login with ur username or email' : 'make an account, find frens in ur city'}</p>
    <div class="tab-toggle">
      <button data-tab="login" class="${isLogin ? 'on' : ''}">login</button>
      <button data-tab="signup" class="${!isLogin ? 'on' : ''}">sign up</button>
    </div>
    <form id="auth-form" autocomplete="off"></form>
    ${isLogin ? `<div class="admin-hint">🛡️ admin demo → username <code>admin</code> · password <code>admin123</code></div>` : ''}
  `;
  $$('.tab-toggle button', card).forEach(b => b.onclick = () => { authTab = b.dataset.tab; renderAuthCard(); });

  const form = $('#auth-form');
  if (isLogin) {
    form.innerHTML = `
      <div class="field"><label>username or email</label><input name="identifier" placeholder="@username / u@email.com" required></div>
      <div class="field"><label>password</label><input name="password" type="password" placeholder="••••••••" required></div>
      <div class="err-line" id="auth-err"></div>
      <button class="btn btn-primary btn-block" type="submit">log in →</button>
    `;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#auth-err');
      err.textContent = '';
      const fd = new FormData(form);
      try {
        const r = await api('/api/login', { method: 'POST', body: { identifier: fd.get('identifier'), password: fd.get('password') } });
        state.token = r.token; state.user = r.user;
        localStorage.setItem('frfr_token', r.token);
        toast('welcome back, ' + r.user.name.split(' ')[0] + ' 🫶', 'good');
        enterApp();
      } catch (ex) { err.textContent = ex.message; }
    };
  } else {
    const m = state.meta;
    const cities = m.cities.map(c => `<option value="${esc(c)}">`).join('');
    const emojis = m.emojis.map(e =>
      `<button type="button" class="avatar-pick ${e === draft.emoji ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('');
    const grads = m.grads.map((g, i) =>
      `<button type="button" class="grad-pick ${i === draft.grad ? 'on' : ''}" data-grad="${i}" style="background:linear-gradient(135deg,${g.from},${g.to})"></button>`).join('');
    const vibes = m.vibes.map(v =>
      `<button type="button" class="vibe-pick ${draft.vibes.includes(v.id) ? 'on' : ''}" data-vibe="${v.id}">${v.emoji} ${esc(v.label)}</button>`).join('');
    form.innerHTML = `
      <div class="field"><label>ur name <span class="req">*</span></label><input name="name" maxlength="24" placeholder="Aarav / Zoya..." required></div>
      <div class="frow">
        <div class="field"><label>username <span class="req">*</span></label><input name="username" maxlength="16" placeholder="cool_user_9" required></div>
        <div class="field"><label>age <span class="req">*</span></label><input name="age" type="number" min="13" max="19" placeholder="13-19" required></div>
      </div>
      <div class="field"><label>email <span class="req">*</span></label><input name="email" type="email" placeholder="u@email.com" required></div>
      <div class="frow">
        <div class="field"><label>password <span class="req">*</span></label><input name="password" type="password" minlength="6" placeholder="min 6 chars" required></div>
        <div class="field"><label>ur city <span class="req">*</span></label><input name="city" list="city-list" placeholder="Mumbai" required><datalist id="city-list">${cities}</datalist></div>
      </div>
      <div class="field"><label>i'm a...</label>
        <select name="gender">${m.genders.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>pick ur avatar</label><div class="avatar-picker">${emojis}</div>
        <div class="grad-picker">${grads}</div>
      </div>
      <div class="field"><label>bio</label><textarea name="bio" maxlength="220" placeholder="professional yapper 🗣️..."></textarea></div>
      <div class="field"><label>ur vibes <span style="text-transform:none;letter-spacing:0">(pick up to 5)</span></label><div class="vibe-grid">${vibes}</div></div>
      <div class="err-line" id="auth-err"></div>
      <button class="btn btn-primary btn-block" type="submit">find my frens 🔥</button>
    `;
    // avatar + vibe pickers
    $$('.avatar-pick', form).forEach(b => b.onclick = () => {
      draft.emoji = b.dataset.emoji;
      $$('.avatar-pick', form).forEach(x => x.classList.toggle('on', x === b));
    });
    $$('.grad-pick', form).forEach(b => b.onclick = () => {
      draft.grad = +b.dataset.grad;
      $$('.grad-pick', form).forEach(x => x.classList.toggle('on', x === b));
    });
    $$('.vibe-pick', form).forEach(b => b.onclick = () => {
      const id = b.dataset.vibe;
      if (draft.vibes.includes(id)) draft.vibes = draft.vibes.filter(v => v !== id);
      else if (draft.vibes.length < 5) draft.vibes.push(id);
      else return toast('max 5 vibes bestie', 'bad');
      b.classList.toggle('on');
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#auth-err');
      err.textContent = '';
      const fd = new FormData(form);
      const body = {
        name: fd.get('name'), username: fd.get('username'), email: fd.get('email'),
        password: fd.get('password'), city: fd.get('city'), age: fd.get('age'),
        gender: fd.get('gender'), bio: fd.get('bio'),
        vibes: draft.vibes, avatarEmoji: draft.emoji, avatarGrad: draft.grad
      };
      try {
        const r = await api('/api/signup', { method: 'POST', body });
        state.token = r.token; state.user = r.user;
        localStorage.setItem('frfr_token', r.token);
        toast('account made! welcome fr 🫶', 'good');
        enterApp();
      } catch (ex) { err.textContent = ex.message; }
    };
  }
}

/* ============================================================
   APP SHELL
   ============================================================ */
async function enterApp() {
  await loadMe();
  if (!state.user) return;
  renderShell();
  setView('deck');
}

async function loadMe() {
  try {
    const r = await api('/api/me');
    state.user = r.user;
    state.likesReceived = r.likesReceived;
    state.matchesCount = r.matches;
  } catch (e) { /* handled in api() */ }
}

function stopTimers() {
  if (state.chatTimer) { clearInterval(state.chatTimer); state.chatTimer = null; }
}

function renderShell() {
  const u = state.user;
  app.innerHTML = `
    <header class="topbar"><div class="topbar-in">
      <div class="logo-sm">frfr<span class="dot">.</span></div>
      <button class="city-chip" id="city-chip" title="tap to change city">📍 ${esc(u.city)}</button>
      <button class="icon-btn" id="mute-btn" title="sound on/off">${state.muted ? '🔇' : '🔊'}</button>
      <button class="icon-btn" id="logout-btn" title="logout">⏏</button>
    </div></header>
    <main class="app-col" id="view-root"></main>
    <nav class="bottom-nav"><div class="bottom-nav-in" id="nav"></div></nav>
  `;
  $('#logout-btn').onclick = doLogout;
  $('#mute-btn').onclick = () => {
    state.muted = !state.muted;
    localStorage.setItem('frfr_muted', state.muted ? '1' : '0');
    $('#mute-btn').textContent = state.muted ? '🔇' : '🔊';
    toast(state.muted ? 'sounds off 🤫' : 'sounds on 🔊');
  };
  $('#city-chip').onclick = () => setView('profile');
  renderNav();
}

function renderNav() {
  const u = state.user;
  const tabs = [
    { id: 'deck', icon: '🔥', label: 'swipe' },
    { id: 'matches', icon: '💬', label: 'chats' },
    ...(u.role === 'admin' ? [{ id: 'admin', icon: '🛡️', label: 'admin' }] : []),
    { id: 'profile', icon: '😎', label: 'me' }
  ];
  $('#nav').innerHTML = tabs.map(t =>
    `<button class="nav-btn ${state.view === t.id && !state.activeMatch ? 'on' : ''}" data-view="${t.id}">
       <span class="ni">${t.icon}</span>${t.label}</button>`).join('');
  $$('#nav .nav-btn').forEach(b => b.onclick = () => {
    if (b.dataset.view === state.view && !state.activeMatch) return;
    setView(b.dataset.view);
  });
}

async function setView(v) {
  stopTimers();
  state.view = v;
  state.activeMatch = null;
  renderNav();
  const root = $('#view-root');
  if (v === 'deck') { renderDeckSkeleton(); await loadDeck(); }
  else if (v === 'matches') { await renderMatches(); }
  else if (v === 'profile') { renderProfile(); }
  else if (v === 'admin') { await renderAdmin(); }
}

async function doLogout() {
  try { await api('/api/logout', { method: 'POST', body: {} }); } catch {}
  localStorage.removeItem('frfr_token');
  state.token = null; state.user = null; state.deck = [];
  toast('logged out. byeee 👋');
  renderLanding();
}

/* ============================================================
   DECK (swiping)
   ============================================================ */
function renderDeckSkeleton() {
  $('#view-root').innerHTML = `
    <div class="deck-wrap">
      <div class="deck-meta">
        <div class="deck-count" id="deck-count"></div>
        <button class="btn btn-ghost btn-sm" id="refresh-deck">↺ refresh</button>
      </div>
      <div class="deck-stage" id="deck-stage"><div class="spin"></div></div>
      <div class="swipe-actions" id="swipe-actions" style="visibility:hidden">
        <button class="act nope" id="btn-nope" title="nope (left)">✕</button>
        <button class="act like" id="btn-like" title="like (right)">❤</button>
      </div>
      <div class="swipe-tip">drag the card ← → or use the buttons · arrow keys work too</div>
    </div>`;
  $('#refresh-deck').onclick = () => loadDeck();
  $('#btn-nope').onclick = () => commitSwipe('left');
  $('#btn-like').onclick = () => commitSwipe('right');
}

async function loadDeck() {
  const stage = $('#deck-stage');
  if (!stage) return;
  try {
    const r = await api('/api/deck');
    state.deck = r.deck;
    renderStack();
  } catch (e) {
    if (stage) stage.innerHTML = `<div class="empty-deck"><div class="big">💀</div><h3>couldn't load</h3><p>${esc(e.message)}</p></div>`;
  }
}

function renderStack() {
  const stage = $('#deck-stage');
  if (!stage) return;
  const count = $('#deck-count');
  if (count) count.innerHTML = state.deck.length ? `<b>${state.deck.length}</b> frens in <b>${esc(state.user.city)}</b> waitin` : '';
  if (!state.deck.length) {
    $('#swipe-actions').style.visibility = 'hidden';
    stage.innerHTML = `
      <div class="empty-deck">
        <div class="big">🫶</div>
        <h3>ur all caught up, bestie!</h3>
        <p>no more frens to swipe in ${esc(state.user.city)} rn.<br>invited ur squad yet? or peep another city from ur profile 👀</p>
        <button class="btn btn-primary" id="refill">↺ check again</button>
      </div>`;
    $('#refill').onclick = () => loadDeck();
    return;
  }
  $('#swipe-actions').style.visibility = 'visible';
  const [top, u1, u2] = state.deck;
  stage.innerHTML = [u2, u1, top].map((u, i) => u ? cardHtml(u, i === 2 ? 'top' : (i === 1 ? 'under-1' : 'under-2')) : '').join('');
  attachDrag($('.card.top', stage));
}

function cardHtml(u, cls) {
  const m = state.meta;
  const vibes = (u.vibes || []).map(id => {
    const v = m.vibes.find(x => x.id === id);
    return v ? `<span class="chip">${v.emoji} ${esc(v.label)}</span>` : '';
  }).join('');
  const grad = gradCss(m, u.avatar.grad);
  return `
  <div class="card ${cls}" data-id="${esc(u.id)}">
    <div class="card-media" style="background:${grad}">
      <span class="card-sparkle" style="top:14%;left:12%">✦</span>
      <span class="card-sparkle" style="top:22%;right:14%;animation-delay:1.2s">✦</span>
      <span class="card-sparkle" style="bottom:20%;left:20%;animation-delay:.6s">✧</span>
      <span class="card-emoji">${esc(u.avatar.emoji)}</span>
      <div class="stamp like">LIKE</div>
      <div class="stamp nope">NOPE</div>
      ${u._likedMe ? '<div class="liked-me-flag">❤ liked u already</div>' : ''}
    </div>
    <div class="card-body">
      <div class="card-name">${esc(u.name)} <span class="age">${u.age}</span> <span class="gen">· ${esc(u.gender)}</span></div>
      <div class="card-loc">📍 ${esc(u.city)}</div>
      ${u.bio ? `<p class="card-bio">${esc(u.bio)}</p>` : ''}
      ${vibes ? `<div class="chips">${vibes}</div>` : ''}
    </div>
  </div>`;
}

function attachDrag(card) {
  if (!card) return;
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
  const likeStamp = $('.stamp.like', card);
  const nopeStamp = $('.stamp.nope', card);

  card.addEventListener('pointerdown', (e) => {
    if (state.swiping) return;
    dragging = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    const rot = dx * 0.055;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    likeStamp.style.opacity = Math.min(1, Math.max(0, dx / 80));
    nopeStamp.style.opacity = Math.min(1, Math.max(0, -dx / 80));
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('dragging');
    const threshold = card.offsetWidth * 0.32;
    if (dx > threshold) commitSwipe('right');
    else if (dx < -threshold) commitSwipe('left');
    else {
      card.style.transition = 'transform .3s cubic-bezier(.2,1.2,.4,1)';
      card.style.transform = '';
      likeStamp.style.opacity = 0; nopeStamp.style.opacity = 0;
      setTimeout(() => { card.style.transition = ''; }, 320);
    }
  };
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
}

async function commitSwipe(dir) {
  if (state.swiping || !state.deck.length) return;
  const u = state.deck[0];
  const card = $(`.card[data-id="${CSS.escape(u.id)}"]`);
  if (!card) return;
  state.swiping = true;

  // audio first so it hits on the gesture
  playSfx(dir === 'right' ? 'happy' : 'ohno');

  card.classList.add(dir === 'right' ? 'fly-right' : 'fly-left');
  const likeStamp = $('.stamp.like', card), nopeStamp = $('.stamp.nope', card);
  if (likeStamp) likeStamp.style.opacity = dir === 'right' ? 1 : 0;
  if (nopeStamp) nopeStamp.style.opacity = dir === 'left' ? 1 : 0;

  let result = null;
  try {
    result = await api('/api/swipe', { method: 'POST', body: { targetId: u.id, dir } });
  } catch (e) { toast(e.message, 'bad'); }

  setTimeout(() => {
    state.deck.shift();
    state.swiping = false;
    renderStack();
    if (result && result.status === 'match') showMatchModal(result.match);
    if (state.deck.length <= 4) loadDeck(); // quietly refill
  }, 380);
}

/* keyboard swiping */
document.addEventListener('keydown', (e) => {
  if (state.view !== 'deck' || state.activeMatch || !state.user) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (e.key === 'ArrowLeft') commitSwipe('left');
  if (e.key === 'ArrowRight') commitSwipe('right');
});

/* ------------------------------------------------------ match modal */
function showMatchModal(match) {
  confetti(80);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="match-card">
      <div class="match-title">IT'S A MATCH!!</div>
      <p class="match-sub">u and ${esc(match.user.name)} liked each other fr fr 🫶</p>
      <div class="match-avatars">
        <div class="mav" style="background:${gradCss(state.meta, state.user.avatar.grad)}">${esc(state.user.avatar.emoji)}</div>
        <div class="match-heart">💜</div>
        <div class="mav" style="background:${gradCss(state.meta, match.user.avatar.grad)}">${esc(match.user.avatar.emoji)}</div>
      </div>
      <div class="match-actions">
        <button class="btn btn-primary btn-block" id="mm-chat">say hi 👋</button>
        <button class="btn btn-ghost btn-block" id="mm-keep">keep swiping</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  sfxHappy.volume = 0.9;
  if (!state.muted) { try { sfxHappy.currentTime = 0; sfxHappy.play().catch(() => {}); } catch {} }
  $('#mm-chat', ov).onclick = async () => {
    ov.remove();
    stopTimers();
    state.view = 'matches';
    renderNav();
    await openChat(match.id, match.user);
  };
  $('#mm-keep', ov).onclick = () => ov.remove();
}

/* ============================================================
   MATCHES + CHAT
   ============================================================ */
async function renderMatches() {
  const root = $('#view-root');
  root.innerHTML = `<h2 class="page-title">ur matches 💜</h2><p class="page-sub">mutual vibes only. tap to start yapping</p><div class="spin"></div>`;
  try {
    const r = await api('/api/matches');
    if (!r.matches.length) {
      root.innerHTML = `
        <h2 class="page-title">ur matches 💜</h2>
        <div class="empty-deck">
          <div class="big">🥺</div>
          <h3>no matches yet</h3>
          <p>go swipe right on ppl from ${esc(state.user.city)} — chemistry awaits 🔥</p>
          <button class="btn btn-primary" id="go-swipe">🔥 start swiping</button>
        </div>`;
      $('#go-swipe').onclick = () => setView('deck');
      return;
    }
    root.innerHTML = `
      <h2 class="page-title">ur matches 💜</h2>
      <p class="page-sub">${r.matches.length} mutual vibe${r.matches.length > 1 ? 's' : ''} · tap to yap</p>
      ${r.matches.map(mt => `
        <button class="match-row" data-id="${esc(mt.id)}" data-name="${esc(mt.user.name)}">
          ${avatarHtml(mt.user)}
          <div class="match-row-mid">
            <div class="match-row-name">${esc(mt.user.name)} <span class="muted-dim">${mt.user.age} · ${esc(mt.user.city)}</span>
              ${!mt.lastMessage ? '<span class="new-dot" title="new match"></span>' : ''}</div>
            <div class="match-row-last">${mt.lastMessage ? (mt.lastMessage.fromMe ? 'u: ' : '') + esc(mt.lastMessage.text) : 'new match — say hi 👋'}</div>
          </div>
          <span class="match-row-time">${mt.lastMessage ? timeAgo(mt.lastMessage.at) : timeAgo(mt.at)}</span>
        </button>`).join('')}`;
    $$('.match-row', root).forEach(b => b.onclick = () => {
      const mt = r.matches.find(x => x.id === b.dataset.id);
      openChat(mt.id, mt.user);
    });
  } catch (e) {
    root.innerHTML = `<div class="empty-deck"><div class="big">💀</div><h3>couldn't load</h3><p>${esc(e.message)}</p></div>`;
  }
}

async function openChat(matchId, otherUser) {
  stopTimers();
  state.activeMatch = { id: matchId, user: otherUser };
  renderNav();
  const root = $('#view-root');
  root.innerHTML = `
    <div class="chat-head">
      <button class="icon-btn" id="chat-back">←</button>
      ${avatarHtml(otherUser, 'sm')}
      <div class="who"><b>${esc(otherUser.name)}</b><span>@${esc(otherUser.username)} · 📍 ${esc(otherUser.city)}</span></div>
    </div>
    <div class="chat-scroll" id="chat-scroll"><div class="spin"></div></div>
    <form class="chat-input" id="chat-form">
      <input id="chat-text" maxlength="1000" placeholder="yap something..." autocomplete="off">
      <button class="chat-send" type="submit">➤</button>
    </form>`;
  $('#chat-back').onclick = () => { stopTimers(); setView('matches'); };

  const scroll = $('#chat-scroll');
  const renderMsgs = (msgs) => {
    scroll.innerHTML = msgs.length ? msgs.map(m => `
      <div class="bubble ${m.fromMe ? 'mine' : 'theirs'}">${esc(m.text)}
        <div class="bubble-time">${clockTime(m.at)}</div>
      </div>`).join('') : `<div class="empty-deck" style="padding:40px 10px"><div class="big">👋</div><h3 style="font-size:16px">say hi to ${esc(otherUser.name)}</h3><p>matching was step 1, yapping is step 2</p></div>`;
    scroll.scrollTop = scroll.scrollHeight;
  };

  let lastIds = new Set();
  const poll = async () => {
    try {
      const r = await api(`/api/matches/${encodeURIComponent(matchId)}/messages`);
      const fresh = r.messages.some(m => !lastIds.has(m.id));
      if (fresh || !scroll.dataset.loaded) {
        renderMsgs(r.messages);
        r.messages.forEach(m => lastIds.add(m.id));
        scroll.dataset.loaded = '1';
      }
    } catch {}
  };
  await poll();
  state.chatTimer = setInterval(poll, 2200);

  $('#chat-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = $('#chat-text');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      const r = await api(`/api/matches/${encodeURIComponent(matchId)}/messages`, { method: 'POST', body: { text } });
      if (!lastIds.has(r.message.id)) {
        lastIds.add(r.message.id);
        const empty = $('.empty-deck', scroll);
        if (empty) scroll.innerHTML = '';
        scroll.insertAdjacentHTML('beforeend', `
          <div class="bubble mine">${esc(r.message.text)}<div class="bubble-time">${clockTime(r.message.at)}</div></div>`);
        scroll.scrollTop = scroll.scrollHeight;
      }
    } catch (ex) { toast(ex.message, 'bad'); input.value = text; }
  };
}

/* ============================================================
   PROFILE
   ============================================================ */
let profileDraft = null;

function renderProfile() {
  const u = state.user;
  profileDraft = {
    name: u.name, bio: u.bio, city: u.city, gender: u.gender, age: u.age,
    vibes: [...(u.vibes || [])], emoji: u.avatar.emoji, grad: u.avatar.grad
  };
  const m = state.meta;
  const root = $('#view-root');
  const grad = gradCss(m, u.avatar.grad);
  const vibes = (u.vibes || []).map(id => {
    const v = m.vibes.find(x => x.id === id);
    return v ? `<span class="chip">${v.emoji} ${esc(v.label)}</span>` : '';
  }).join('');
  const emojis = m.emojis.map(e => `<button type="button" class="avatar-pick ${e === profileDraft.emoji ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('');
  const grads = m.grads.map((g, i) => `<button type="button" class="grad-pick ${i === profileDraft.grad ? 'on' : ''}" data-grad="${i}" style="background:linear-gradient(135deg,${g.from},${g.to})"></button>`).join('');
  const cities = m.cities.map(c => `<option value="${esc(c)}">`).join('');
  const vibeBtns = m.vibes.map(v => `<button type="button" class="vibe-pick ${profileDraft.vibes.includes(v.id) ? 'on' : ''}" data-vibe="${v.id}">${v.emoji} ${esc(v.label)}</button>`).join('');

  root.innerHTML = `
    <div class="me-card">
      <div class="me-card-media" style="background:${grad}" id="me-media">
        <span class="card-emoji" id="me-emoji">${esc(u.avatar.emoji)}</span>
      </div>
      <div class="me-card-body">
        <div class="card-name">${esc(u.name)} <span class="age">${u.age}</span></div>
        <div class="card-loc">@${esc(u.username)} · 📍 ${esc(u.city)} · ${esc(u.gender)}</div>
        ${u.bio ? `<p class="card-bio">${esc(u.bio)}</p>` : ''}
        ${vibes ? `<div class="chips">${vibes}</div>` : ''}
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-box"><b>${state.likesReceived}</b><span>❤ got</span></div>
      <div class="stat-box"><b>${state.matchesCount}</b><span>💜 matches</span></div>
      <div class="stat-box"><b>${u.role === 'admin' ? '🛡️' : '✨'}</b><span>${u.role === 'admin' ? 'admin' : 'member'}</span></div>
    </div>

    <h2 class="page-title" style="font-size:18px">edit ur vibe 🎨</h2>
    <p class="page-sub">change city to see frens somewhere else</p>
    <form id="edit-form">
      <div class="frow">
        <div class="field"><label>name</label><input name="name" maxlength="24" value="${esc(profileDraft.name)}"></div>
        <div class="field"><label>age</label><input name="age" type="number" min="13" max="19" value="${profileDraft.age}"></div>
      </div>
      <div class="frow">
        <div class="field"><label>city</label><input name="city" list="city-list-e" value="${esc(profileDraft.city)}"><datalist id="city-list-e">${cities}</datalist></div>
        <div class="field"><label>i'm a...</label>
          <select name="gender">${m.genders.map(g => `<option value="${esc(g)}" ${g === profileDraft.gender ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>bio</label><textarea name="bio" maxlength="220">${esc(profileDraft.bio)}</textarea></div>
      <div class="field"><label>avatar</label><div class="avatar-picker" id="ep-emoji">${emojis}</div><div class="grad-picker" id="ep-grad">${grads}</div></div>
      <div class="field"><label>vibes (max 5)</label><div class="vibe-grid" id="ep-vibes">${vibeBtns}</div></div>
      <div style="display:flex;gap:10px;margin:16px 0 30px">
        <button class="btn btn-primary" type="submit" style="flex:1">save changes ✌️</button>
      </div>
    </form>`;

  const syncPreview = () => {
    $('#me-emoji').textContent = profileDraft.emoji;
    $('#me-media').style.background = gradCss(m, profileDraft.grad);
  };
  $$('#ep-emoji .avatar-pick').forEach(b => b.onclick = () => {
    profileDraft.emoji = b.dataset.emoji;
    $$('#ep-emoji .avatar-pick').forEach(x => x.classList.toggle('on', x === b));
    syncPreview();
  });
  $$('#ep-grad .grad-pick').forEach(b => b.onclick = () => {
    profileDraft.grad = +b.dataset.grad;
    $$('#ep-grad .grad-pick').forEach(x => x.classList.toggle('on', x === b));
    syncPreview();
  });
  $$('#ep-vibes .vibe-pick').forEach(b => b.onclick = () => {
    const id = b.dataset.vibe;
    if (profileDraft.vibes.includes(id)) profileDraft.vibes = profileDraft.vibes.filter(v => v !== id);
    else if (profileDraft.vibes.length < 5) profileDraft.vibes.push(id);
    else return toast('max 5 vibes bestie', 'bad');
    b.classList.toggle('on');
  });

  $('#edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/api/me', {
        method: 'PUT',
        body: {
          name: fd.get('name'), age: fd.get('age'), city: fd.get('city'),
          gender: fd.get('gender'), bio: fd.get('bio'),
          vibes: profileDraft.vibes, avatar: { emoji: profileDraft.emoji, grad: profileDraft.grad }
        }
      });
      const cityChanged = r.user.city !== state.user.city;
      state.user = r.user;
      $('#city-chip').innerHTML = `📍 ${esc(r.user.city)}`;
      toast(cityChanged ? 'city updated — fresh frens loading 🔥' : 'saved ✌️', 'good');
      await loadMe();
      renderProfile();
      if (cityChanged) { state.deck = []; }
    } catch (ex) { toast(ex.message, 'bad'); }
  };
}

/* ============================================================
   ADMIN
   ============================================================ */
let adminRows = [];

async function renderAdmin() {
  const root = $('#view-root');
  root.innerHTML = `<h2 class="page-title">admin panel 🛡️</h2><div class="spin"></div>`;
  try {
    const [stats, usersR] = await Promise.all([api('/api/admin/stats'), api('/api/admin/users')]);
    adminRows = usersR.users;
    const s = stats;
    const maxUsers = Math.max(1, ...s.cities.top.map(c => c.users));
    root.innerHTML = `
      <h2 class="page-title">admin panel 🛡️</h2>
      <p class="page-sub">how's frfr doing today — live numbers, no cap</p>

      <div class="stat-grid">
        <div class="stat-card"><b>${s.users.real}</b><span>real users</span></div>
        <div class="stat-card purple"><b>${s.users.demo}</b><span>demo frens</span></div>
        <div class="stat-card cyan"><b>${s.cities.count}</b><span>cities active</span></div>
        <div class="stat-card pink"><b>${s.matches}</b><span>matches made</span></div>
        <div class="stat-card"><b>${s.swipes.right}</b><span>❤ right swipes</span></div>
        <div class="stat-card pink"><b>${s.swipes.left}</b><span>✕ left swipes</span></div>
        <div class="stat-card cyan"><b>${s.messages}</b><span>messages sent</span></div>
        <div class="stat-card purple"><b>${s.signupsWeek}</b><span>signups (7d)</span></div>
      </div>

      <h2 class="page-title" style="font-size:17px">city leaderboard 📍</h2>
      <p class="page-sub">users per city · ${s.cities.top.length} shown</p>
      ${s.cities.top.map(c => `
        <div class="bar-row">
          <div class="bar-label">${esc(c.city)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((c.users / maxUsers) * 100)}%"></div></div>
          <div class="bar-num">${c.users}</div>
        </div>`).join('')}

      <h2 class="page-title" style="font-size:17px">all users 👥</h2>
      <p class="page-sub">${adminRows.length} accounts · <input id="admin-q" placeholder="🔍 filter by name/city/username" style="background:rgba(0,0,0,.35);border:1px solid var(--line);border-radius:999px;padding:8px 14px;outline:none;width:100%;max-width:280px;margin-top:6px"></p>
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" id="admin-refresh">↺ refresh</button>
      </div>
      <div class="admin-table-wrap"><table class="admin">
        <thead><tr><th>who</th><th>@user</th><th>city</th><th>age</th><th>type</th><th>❤→</th><th>💜</th><th>💬</th><th>joined</th><th></th></tr></thead>
        <tbody id="admin-rows"></tbody>
      </table></div>
      <div class="section-gap"></div>`;

    const drawRows = (q) => {
      const t = (q || '').trim().toLowerCase();
      const rows = adminRows.filter(u => !t || `${u.name} ${u.username} ${u.city} ${u.email}`.toLowerCase().includes(t));
      $('#admin-rows').innerHTML = rows.map(u => `
        <tr>
          <td><b>${esc(u.name)}</b><div class="muted-dim" style="font-size:11px">${esc(u.email)}</div></td>
          <td>@${esc(u.username)}</td>
          <td>${esc(u.city)}</td>
          <td>${u.age}</td>
          <td><span class="tag ${u.isBot ? 'demo' : 'real'}">${u.isBot ? 'demo' : 'real'}</span></td>
          <td>${u.swipesGiven}</td>
          <td>${u.matches}</td>
          <td>${u.msgs}</td>
          <td>${timeAgo(u.createdAt)}</td>
          <td><button class="del-btn" data-id="${esc(u.id)}" data-name="${esc(u.name)}">delete</button></td>
        </tr>`).join('') || `<tr><td colspan="10" class="muted-dim" style="text-align:center;padding:24px">no users match "${esc(t)}"</td></tr>`;
      $$('#admin-rows .del-btn').forEach(b => b.onclick = () => deleteUser(b.dataset.id, b.dataset.name));
    };
    drawRows('');
    $('#admin-q').oninput = (e) => drawRows(e.target.value);
    $('#admin-refresh').onclick = () => renderAdmin();
  } catch (e) {
    root.innerHTML = `<div class="empty-deck"><div class="big">🛡️</div><h3>admin eyes only</h3><p>${esc(e.message)}</p></div>`;
  }
}

async function deleteUser(id, name) {
  if (!confirm(`delete ${name}'s account fr? this can't be undone 💀`)) return;
  try {
    await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast(name + ' deleted 👋', 'good');
    renderAdmin();
  } catch (e) { toast(e.message, 'bad'); }
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  try {
    state.meta = await api('/api/meta');
  } catch {
    state.meta = {
      cities: ['Mumbai', 'New Delhi', 'Bengaluru'], genders: ['prefer not to say'],
      emojis: ['😎', '🔥'], grads: [{ from: '#ff4d8d', to: '#8b5cf6' }],
      vibes: [], stats: { frens: 0, cities: 0 }
    };
  }
  if (state.token) {
    try {
      const r = await api('/api/me');
      state.user = r.user;
      state.likesReceived = r.likesReceived;
      state.matchesCount = r.matches;
      renderShell();
      setView('deck');
      return;
    } catch { /* token dead — landing */ }
  }
  renderLanding();
}

boot();
