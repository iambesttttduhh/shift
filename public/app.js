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
  view: 'feed',           // feed | matches | requests | explore | profile | admin
  activeMatch: null,     // match object when in chat
  chatTimer: null,
  muted: localStorage.getItem('frfr_muted') === '1',
  pending: null,   // { token, email, name, mailMode, devCode } during email verification
  reqCount: 0,     // pending incoming friend requests
  feed: { items: [], page: 0, done: false, loading: false }
};

/* cat reaction animations (happy 😸 on like/accept · sad 😿 on reject) */
function catAnimation(kind, x, y) {
  if (state.muted) return;
  const happy = kind === 'happy';
  const el = document.createElement('div');
  el.className = 'cat-fx ' + (happy ? 'cat-happy' : 'cat-sad');
  const cx = typeof x === 'number' ? Math.min(Math.max(x, 90), (window.innerWidth || 400) - 90) : (window.innerWidth || 400) / 2;
  const cy = typeof y === 'number' ? Math.min(Math.max(y, 110), (window.innerHeight || 700) - 190) : (window.innerHeight || 700) * 0.4;
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  const main = document.createElement('span');
  main.className = 'cat-main';
  main.textContent = happy ? (Math.random() > 0.5 ? '😸' : '😻') : '😿';
  el.appendChild(main);
  if (happy) {
    ['💖', '✨', '💜'].forEach((s, i) => {
      const sp = document.createElement('span');
      sp.className = 'cat-spark';
      sp.textContent = s;
      sp.style.left = (-48 + i * 46) + 'px';
      sp.style.top = (-34 + (i % 2) * 56) + 'px';
      sp.style.animationDelay = (i * 0.09) + 's';
      el.appendChild(sp);
    });
  } else {
    for (let i = 0; i < 3; i++) {
      const t = document.createElement('span');
      t.className = 'cat-tear';
      t.textContent = '💧';
      t.style.left = (12 + i * 24) + 'px';
      t.style.top = '30px';
      t.style.animationDelay = (0.15 + i * 0.15) + 's';
      el.appendChild(t);
    }
  }
  fx.appendChild(el);
  setTimeout(() => el.remove(), 1400);
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
  const inner = u.photo
    ? `<img src="${u.photo}" alt="">`
    : esc(u.avatar.emoji);
  return `<div class="avatar ${cls}" style="background:${gradCss(state.meta, u.avatar.grad)}" title="${esc(u.name)}">${inner}</div>`;
}

/* resize any image file to a small jpeg dataURL so uploads stay tiny */
function pickPhoto(file, cb) {
  if (!file || !file.type.startsWith('image/')) return toast('pick an image file 🖼️', 'bad');
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const S = 400;
    const scale = Math.min(S / img.width, S / img.height, 1);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    cb(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('couldnt read that image 💀', 'bad'); };
  img.src = url;
}

function photoThumbsHtml(photos) {
  return `<div class="photo-thumbs">
    ${photos.map((p, i) => `
      <div class="photo-thumb ${i === 0 ? 'cover' : ''}" style="background-image:url('${p}')">
        <button type="button" class="thumb-x" data-i="${i}">✕</button>
        ${i === 0 ? '<span class="cover-tag">cover</span>' : ''}
      </div>`).join('')}
    ${photos.length < 3 ? '<button type="button" class="photo-add" id="photo-add">＋ pic</button>' : ''}
  </div>`;
}

function renderPhotoField(photos, onChange) {
  const host = $('#photo-field-host');
  if (!host) return;
  host.innerHTML = `
    <div class="field"><label>ur pics <span style="text-transform:none;letter-spacing:0">(up to 3 · first = cover, shows on the feed)</span></label>
      ${photoThumbsHtml(photos)}
      <input type="file" id="photo-file" accept="image/*" hidden>
    </div>`;
  const addBtn = $('#photo-add', host);
  const file = $('#photo-file', host);
  if (addBtn) addBtn.onclick = () => file.click();
  if (file) file.onchange = () => {
    if (file.files && file.files[0]) {
      pickPhoto(file.files[0], (durl) => {
        file.value = '';
        onChange([...photos, durl]);
      });
    }
  };
  $$('.thumb-x', host).forEach(x => x.onclick = () => {
    const i = +x.dataset.i;
    onChange(photos.slice(0, i).concat(photos.slice(i + 1)));
  });
}

/* ============================================================
   LANDING / AUTH
   ============================================================ */
let authTab = 'login';
let draft = { emoji: '😎', grad: 0, vibes: [], photo: null }; // signup form draft (avatar/vibes/photo picks)

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
        <div class="ver-tag">v2.2 ✦ if u can read this, u got the newest build</div>
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
        if (r.needVerification) {
          state.pending = { token: r.verifyToken, email: r.email, name: r.name, mailMode: r.mailMode, devCode: r.devCode };
          renderVerifyScreen();
          return;
        }
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
      <div id="photo-field-host"></div>
      <div class="frow">
        <div class="field"><label>username <span class="req">*</span></label><input name="username" maxlength="16" placeholder="cool_user_9" required></div>
        <div class="field"><label>age <span class="req">*</span></label><input name="age" type="number" min="13" max="19" placeholder="13-19" required></div>
      </div>
      <div class="field"><label>email <span class="req">*</span> <span style="text-transform:none;letter-spacing:0">(any real email — we send a code 📬)</span></label><input name="email" type="email" placeholder="u@email.com" required></div>
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
    draft.photo = null;
    const rerenderPics = (arr) => {
      draft.photo = arr[0] || null;
      renderPhotoField(arr, rerenderPics);
    };
    renderPhotoField([], rerenderPics);
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
        vibes: draft.vibes, avatarEmoji: draft.emoji, avatarGrad: draft.grad,
        photo: draft.photo || undefined
      };
      try {
        const r = await api('/api/signup', { method: 'POST', body });
        if (r.needVerification) {
          state.pending = { token: r.verifyToken, email: r.email, name: r.name, mailMode: r.mailMode, devCode: r.devCode };
          renderVerifyScreen();
          return;
        }
        state.token = r.token; state.user = r.user;
        localStorage.setItem('frfr_token', r.token);
        toast('account made! welcome fr 🫶', 'good');
        enterApp();
      } catch (ex) { err.textContent = ex.message; }
    };
  }
}

/* ============================================================
   EMAIL VERIFICATION SCREEN
   ============================================================ */
function renderVerifyScreen() {
  stopTimers();
  const p = state.pending;
  if (!p) return renderLanding();
  app.innerHTML = `
  <div class="landing">
    <div class="landing-inner" style="max-width:440px">
      <div class="auth-card" style="text-align:center">
        <div style="font-size:52px;margin-bottom:6px">📬</div>
        <h2 class="auth-title">check ur email!</h2>
        <p class="auth-sub">we sent a <b>4-digit code</b> to<br><b style="color:var(--lime)">${esc(p.email)}</b><br>enter it below to verify <b>${esc(p.name)}</b> 🔐</p>
        ${p.devCode ? `<div class="demo-code">🧪 demo mode (no gmail connected yet)<br>ur code is: <b id="demo-code-num">${esc(p.devCode)}</b><br><span style="font-size:10.5px;opacity:.7">admin panel → email delivery 📧 → add ur gmail app password to send real emails</span></div>` : ''}
        <form id="verify-form" autocomplete="off">
          <input class="vcode" id="vcode" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="••••" autofocus>
          <div class="err-line" id="v-err"></div>
          <button class="btn btn-primary btn-block" type="submit" id="v-btn">verify me ✅</button>
        </form>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="btn btn-ghost btn-sm" style="flex:1" id="v-resend" disabled>resend code (45s)</button>
          <button class="btn btn-ghost btn-sm" style="flex:1" id="v-back">↩ different email</button>
        </div>
      </div>
    </div>
  </div>`;

  const input = $('#vcode');
  input.addEventListener('input', () => { input.value = input.value.replace(/[^0-9]/g, '').slice(0, 4); });
  setTimeout(() => input.focus(), 50);

  let left = 45;
  const rbtn = $('#v-resend');
  const tick = setInterval(() => {
    left--;
    if (left <= 0) { clearInterval(tick); rbtn.disabled = false; rbtn.textContent = '📨 resend code'; }
    else rbtn.textContent = `resend code (${left}s)`;
  }, 1000);

  $('#v-back').onclick = () => { clearInterval(tick); state.pending = null; renderLanding(); };

  rbtn.onclick = async () => {
    if (rbtn.disabled) return;
    rbtn.disabled = true; left = 45;
    const t = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(t); rbtn.disabled = false; rbtn.textContent = '📨 resend code'; }
      else rbtn.textContent = `resend code (${left}s)`;
    }, 1000);
    try {
      const r = await api('/api/verify/resend', { method: 'POST', body: { token: p.token } });
      p.mailMode = r.mailMode;
      if (r.devCode) {
        p.devCode = r.devCode;
        const banner = $('.demo-code');
        if (banner) $('#demo-code-num', banner) ? banner.innerHTML = `🧪 demo mode (no gmail connected yet)<br>ur code is: <b id="demo-code-num">${esc(r.devCode)}</b><br><span style="font-size:10.5px;opacity:.7">admin panel → email delivery 📧 → add ur gmail app password to send real emails</span>` : null;
      }
      $('#v-err').textContent = '';
      toast('new code sent 📨', 'good');
    } catch (ex) {
      $('#v-err').textContent = ex.message;
      clearInterval(t); rbtn.disabled = false; rbtn.textContent = '📨 resend code';
    }
  };

  $('#verify-form').onsubmit = async (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (code.length !== 4) { $('#v-err').textContent = 'enter all 4 digits bestie'; return; }
    try {
      const r = await api('/api/verify', { method: 'POST', body: { token: p.token, code } });
      state.pending = null;
      state.token = r.token; state.user = r.user;
      localStorage.setItem('frfr_token', r.token);
      confetti(50);
      toast('email verified ✅ welcome fr 🫶', 'good');
      enterApp();
    } catch (ex) {
      $('#v-err').textContent = ex.message;
      input.value = ''; input.focus();
    }
  };
}

/* ============================================================
   APP SHELL
   ============================================================ */
async function enterApp() {
  await loadMe();
  if (!state.user) return;
  renderShell();
  setView('feed');
}

async function loadMe() {
  try {
    const r = await api('/api/me');
    state.user = r.user;
    state.likesReceived = r.likesReceived;
    state.matchesCount = r.matches;
    state.reqCount = r.reqCount || 0;
  } catch (e) { /* handled in api() */ }
  updateReqBadge();
}

function updateReqBadge() {
  const bell = $('#nav-req-dot');
  if (bell) {
    bell.style.display = state.reqCount > 0 ? 'grid' : 'none';
    bell.textContent = state.reqCount > 9 ? '9+' : state.reqCount;
  }
}

function stopTimers() {
  if (state.chatTimer) { clearInterval(state.chatTimer); state.chatTimer = null; }
}

function renderShell() {
  const u = state.user;
  app.innerHTML = `
    <header class="topbar"><div class="topbar-in">
      <div class="logo-sm" id="tb-logo">frfr<span class="dot">.</span></div>
      <button class="icon-btn tb-icon" id="tb-explore" title="explore">🧭</button>
      <button class="city-chip" id="city-chip" title="tap to change city">📍 ${esc(u.city)}</button>
      <button class="icon-btn ${state.muted ? 'off' : ''}" id="mute-btn" title="cat animations on/off">😸</button>
      <button class="icon-btn" id="logout-btn" title="settings / logout">⚙</button>
    </div></header>
    <main class="app-col" id="view-root"></main>
    <nav class="bottom-nav"><div class="bottom-nav-in" id="nav"></div></nav>
  `;
  $('#logout-btn').onclick = openSettingsMenu;
  $('#tb-explore').onclick = () => setView('explore');
  $('#tb-logo').onclick = () => setView('feed');
  $('#mute-btn').onclick = () => {
    state.muted = !state.muted;
    localStorage.setItem('frfr_muted', state.muted ? '1' : '0');
    const b = $('#mute-btn');
    b.classList.toggle('off', state.muted);
    toast(state.muted ? 'cat animations off 🚫🐱' : 'cat animations on 🐱');
  };
  $('#city-chip').onclick = () => setView('profile');
  renderNav();
}

function renderNav() {
  const u = state.user;
  const tabs = [
    { id: 'matches', icon: '💬', label: 'frens' },
    { id: 'requests', icon: '💌', label: 'requests', dot: true },
    { id: 'feed', icon: '🔥', label: 'feed', big: true },
    { id: 'explore', icon: '🧭', label: 'explore' },
    ...(u.role === 'admin' ? [{ id: 'admin', icon: '🛡️', label: 'admin' }] : [{ id: 'profile', icon: '😎', label: 'me' }])
  ];
  $('#nav').innerHTML = tabs.map(t =>
    `<button class="nav-btn ${t.big ? 'big ' : ''}${state.view === t.id && !state.activeMatch ? 'on' : ''}" data-view="${t.id}">
       <span class="ni">${t.icon}</span>${t.big ? '' : t.label}
       ${t.dot ? '<span class="nav-dot" id="nav-req-dot" style="display:none"></span>' : ''}
     </button>`).join('');
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
  if (v === 'feed') { initFeed(); }
  else if (v === 'matches') { await renderMatches(); }
  else if (v === 'requests') { await renderRequests(); }
  else if (v === 'explore') { renderExplore(); }
  else if (v === 'nearby') { renderNearby(); }
  else if (v === 'vibecheck') { renderVibeCheck(); }
  else if (v === 'profile') { renderProfile(); }
  else if (v === 'admin') { await renderAdmin(); }
}

function overlayCard(html) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = html;
  document.body.appendChild(ov);
  return ov;
}

function openSettingsMenu() {
  const ov = overlayCard(`
    <div class="match-card" style="max-width:330px">
      <div class="match-title" style="font-size:26px">settings ⚙</div>
      <p class="match-sub">what do u wanna do?</p>
      <div class="match-actions">
        <button class="btn btn-primary btn-block" id="st-profile">😎 my profile</button>
        <button class="btn btn-ghost btn-block" id="st-explore">🧭 explore</button>
        <button class="btn btn-ghost btn-block" id="st-sound">${state.muted ? '😸 cat animations: off' : '😸 cat animations: on'}</button>
        <button class="btn btn-pink btn-block" id="st-logout">🚪 log out</button>
        <button class="btn btn-ghost btn-block" id="st-close">close</button>
      </div>
    </div>`);
  $('#st-profile', ov).onclick = () => { ov.remove(); setView('profile'); };
  $('#st-explore', ov).onclick = () => { ov.remove(); setView('explore'); };
  $('#st-sound', ov).onclick = () => {
    state.muted = !state.muted;
    localStorage.setItem('frfr_muted', state.muted ? '1' : '0');
    const mb = $('#mute-btn'); if (mb) mb.classList.toggle('off', state.muted);
    ov.remove();
    toast(state.muted ? 'cat animations off 🚫🐱' : 'cat animations on 🐱');
  };
  $('#st-logout', ov).onclick = () => {
    ov.innerHTML = `
      <div class="match-card" style="max-width:330px">
        <div class="match-title" style="font-size:26px">log out?</div>
        <p class="match-sub">ur matches will be waiting fr 🥺</p>
        <div class="match-actions">
          <button class="btn btn-pink btn-block" id="lo-yes">yes, log out</button>
          <button class="btn btn-ghost btn-block" id="lo-no">stay</button>
        </div>
      </div>`;
    $('#lo-yes', ov).onclick = async () => { ov.remove(); await doLogout(); };
    $('#lo-no', ov).onclick = () => ov.remove();
  };
  $('#st-close', ov).onclick = () => ov.remove();
}

async function doLogout() {
  try { await api('/api/logout', { method: 'POST', body: {} }); } catch {}
  localStorage.removeItem('frfr_token');
  state.token = null; state.user = null; state.deck = [];
  toast('logged out. byeee 👋');
  renderLanding();
}

/* ============================================================
   FEED — scroll profiles, double-tap to send a friend request 💌
   ============================================================ */
function initFeed() {
  stopTimers();
  state.feed = { items: [], page: 0, done: false, loading: false };
  $('#view-root').innerHTML = `
    <div class="feed-wrap">
      <div class="deck-meta">
        <div class="deck-count" id="feed-count"></div>
        <button class="btn btn-ghost btn-sm" id="feed-refresh">↺ refresh</button>
      </div>
      <div class="feed" id="feed"><div class="spin"></div></div>
      <div class="swipe-tip">double-tap a profile = friend request 💌 · scroll past the ones u dont vibe with</div>
    </div>`;
  $('#feed-refresh').onclick = () => initFeed();
  const feed = $('#feed');
  feed.addEventListener('scroll', () => {
    if (feed.scrollTop + feed.clientHeight > feed.scrollHeight - 420) loadFeedPage();
  });
  loadFeedPage();
}

async function loadFeedPage() {
  const f = state.feed;
  if (f.loading || f.done) return;
  f.loading = true;
  try {
    const r = await api('/api/feed?page=' + f.page + '&limit=6');
    f.items = f.items.concat(r.items);
    f.page++;
    f.done = r.done;
    const count = $('#feed-count');
    if (count) count.innerHTML = '<b>' + r.total + '</b> frens in <b>' + esc(state.user.city) + '</b>';
    const feedEl = $('#feed');
    if (!feedEl) { f.loading = false; return; }
    const empty = $('.feed-empty', feedEl);
    if (empty) empty.remove();
    const spinner = $('.spin', feedEl);
    if (spinner) spinner.remove();
    if (!f.items.length) {
      feedEl.innerHTML = `
        <div class="feed-empty">
          <div class="big">🫶</div>
          <h3>no more profiles rn</h3>
          <p>u seen everyone in ${esc(state.user.city)}! change city from ur profile or check back later 👀</p>
          <button class="btn btn-primary" id="feed-refill">↺ check again</button>
        </div>`;
      const b = $('#feed-refill');
      if (b) b.onclick = () => initFeed();
      f.loading = false;
      return;
    }
    const startIdx = f.items.length - r.items.length;
    r.items.forEach((u, i) => feedEl.insertAdjacentHTML('beforeend', feedCardHtml(u, startIdx + i)));
    wireFeedCards(r.items);
  } catch (e) {
    const feedEl = $('#feed');
    if (feedEl && !f.items.length) feedEl.innerHTML = '<div class="feed-empty"><div class="big">💀</div><h3>couldn&apos;t load</h3><p>' + esc(e.message) + '</p></div>';
  }
  f.loading = false;
}

function feedCardHtml(u) {
  const m = state.meta;
  const vibes = (u.vibes || []).map(id => {
    const v = m.vibes.find(x => x.id === id);
    return v ? `<span class="chip">${v.emoji} ${esc(v.label)}</span>` : '';
  }).join('');
  const grad = gradCss(m, u.avatar.grad);
  const photos = u.photos || [];
  let btn;
  if (u._reqStatus === 'pending') btn = `<button class="rail-btn pending" data-id="${esc(u.id)}" title="request sent — waiting">⏳</button>`;
  else if (u._likesYou) btn = `<button class="rail-btn likesyou" data-id="${esc(u.id)}" title="wants to be ur fren — tap back!">💌</button>`;
  else btn = `<button class="rail-btn like" data-id="${esc(u.id)}" title="double-tap or tap = friend request">❤</button>`;
  return `
  <div class="feed-card" data-id="${esc(u.id)}" data-photo="0">
    <div class="feed-media" style="background:${grad}">
      ${photos.length
        ? `<img class="feed-photo" src="${photos[0]}" alt="">`
        : `<span class="card-emoji">${esc(u.avatar.emoji)}</span>`}
      ${photos.length > 1 ? `
        <button class="gal-btn gal-prev" title="prev pic">‹</button>
        <button class="gal-btn gal-next" title="next pic">›</button>
        <div class="gal-dots">${photos.map((_, di) => `<span class="${di === 0 ? 'on' : ''}"></span>`).join('')}</div>` : ''}
      ${u._likesYou ? '<div class="liked-me-flag">💌 wants to be ur fren</div>' : ''}
      <div class="stamp like">FREN REQ 💌</div>
    </div>
    <div class="feed-info">
      <div class="card-name">${esc(u.name)} <span class="age">${u.age}</span> <span class="gen">· ${esc(u.gender)}</span></div>
      <div class="card-loc">📍 ${esc(u.city)} · @${esc(u.username)}</div>
      ${u.bio ? `<p class="card-bio">${esc(u.bio)}</p>` : ''}
      ${vibes ? `<div class="chips">${vibes}</div>` : ''}
    </div>
    <div class="feed-rail">${btn}</div>
  </div>`;
}

function wireFeedCards(items) {
  items.forEach(u => {
    const card = $('.feed-card[data-id="' + CSS.escape(u.id) + '"]');
    if (!card) return;
    const photos = u.photos || [];

    const showPic = (n) => {
      const i = ((n % photos.length) + photos.length) % photos.length;
      card.dataset.photo = i;
      const img = $('.feed-photo', card);
      if (img) img.src = photos[i];
      $$('.gal-dots span', card).forEach((d, di) => d.classList.toggle('on', di === i));
    };
    const prev = $('.gal-prev', card), next = $('.gal-next', card);
    if (prev) prev.onclick = (e) => { e.stopPropagation(); showPic(+card.dataset.photo - 1); };
    if (next) next.onclick = (e) => { e.stopPropagation(); showPic(+card.dataset.photo + 1); };

    // double-tap = friend request (with drag guard so scrolling doesn't trigger)
    let lastTap = 0, lastX = 0, lastY = 0, downX = 0, downY = 0;
    card.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.rail-btn') || e.target.closest('.gal-btn')) return;
      downX = e.clientX; downY = e.clientY;
      const now = Date.now();
      const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      if (now - lastTap < 350 && dist < 80) {
        lastTap = 0;
        heartBurst(e.clientX, e.clientY);
        sendFriendRequest(u.id);
      } else { lastTap = now; lastX = e.clientX; lastY = e.clientY; }
    });
    card.addEventListener('dblclick', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 14) return; // was a scroll/drag
      if (e.target.closest('.rail-btn') || e.target.closest('.gal-btn')) return;
      heartBurst(e.clientX, e.clientY);
      sendFriendRequest(u.id);
    });

    const btn = $('.rail-btn', card);
    if (btn) btn.onclick = () => sendFriendRequest(u.id, btn);
  });
}

async function sendFriendRequest(targetId, btn) {
  const card = $('.feed-card[data-id="' + CSS.escape(targetId) + '"]');
  const railBtn = btn || (card && $('.rail-btn', card));
  if (railBtn && railBtn.classList.contains('pending')) { toast('request already sent ⏳ patience bestie'); return; }
  try {
    const r = await api('/api/request', { method: 'POST', body: { targetId } });
    if (r.status === 'mutual') {
      confetti(70);
      state.matchesCount++;
      if (card) {
        card.style.transition = 'transform .45s, opacity .45s';
        card.style.transform = 'scale(.8)';
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 470);
      }
      showFrensModal(r.match);
    } else if (r.status === 'sent') {
      toast('friend request sent 💌');
      catAnimation('happy');
      state.likesReceived++;
      if (railBtn) { railBtn.classList.remove('like', 'likesyou'); railBtn.classList.add('pending'); railBtn.textContent = '⏳'; }
      const stamp = card && $('.stamp.like', card);
      if (stamp) { stamp.style.opacity = '1'; setTimeout(() => { stamp.style.opacity = '0'; }, 900); }
    } else if (r.status === 'already') {
      toast('request already sent ⏳ patience bestie');
      if (railBtn) { railBtn.classList.remove('like', 'likesyou'); railBtn.classList.add('pending'); railBtn.textContent = '⏳'; }
    }
  } catch (e) { toast(e.message, 'bad'); }
}

/* dopamine: floating hearts + happy cat at tap point */
function heartBurst(x, y) {
  catAnimation('happy', x, y);
  const big = document.createElement('div');
  big.className = 'big-heart';
  big.style.cssText = 'left:' + (x - 40) + 'px;top:' + (y - 40) + 'px;';
  big.textContent = ['💜', '💖', '❤️'][Math.floor(Math.random() * 3)];
  fx.appendChild(big);
  setTimeout(() => big.remove(), 900);
  for (let i = 0; i < 10; i++) {
    const h = document.createElement('div');
    h.className = 'burst-heart';
    const ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.6;
    const dist = 60 + Math.random() * 90;
    h.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.round(Math.cos(ang) * dist) + 'px;--dy:' + Math.round((Math.sin(ang) * dist - 60)) + 'px;font-size:' + (14 + Math.random() * 16) + 'px;';
    h.textContent = ['❤️', '💖', '💜', '🩷', '💕'][Math.floor(Math.random() * 5)];
    fx.appendChild(h);
    setTimeout(() => h.remove(), 1100);
  }
}

/* ------------------------------------------------------ match modal */
function showMatchModal(match) {
  confetti(80);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="match-card">
      <div class="match-title">Y'ALL ARE FRENS!!</div>
      <p class="match-sub">u and ${esc(match.user.name)} are frens now fr fr 🫶</p>
      <div class="match-avatars">
        <div class="mav" style="background:${gradCss(state.meta, state.user.avatar.grad)}">${state.user.photo ? `<img src="${state.user.photo}" alt="">` : esc(state.user.avatar.emoji)}</div>
        <div class="match-heart">💜</div>
        <div class="mav" style="background:${gradCss(state.meta, match.user.avatar.grad)}">${match.user.photo ? `<img src="${match.user.photo}" alt="">` : esc(match.user.avatar.emoji)}</div>
      </div>
      <div class="match-actions">
        <button class="btn btn-primary btn-block" id="mm-chat">say hi 👋</button>
        <button class="btn btn-ghost btn-block" id="mm-keep">keep scrolling</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  catAnimation('happy');
  $('#mm-chat', ov).onclick = async () => {
    ov.remove();
    stopTimers();
    state.view = 'matches';
    renderNav();
    await openChat(match.id, match.user);
  };
  $('#mm-keep', ov).onclick = () => ov.remove();
}

const showFrensModal = showMatchModal;

/* ============================================================
   MATCHES + CHAT
   ============================================================ */
async function renderMatches() {
  const root = $('#view-root');
  root.innerHTML = `<h2 class="page-title">ur frens 💜</h2><p class="page-sub">mutual vibe check passed. tap to yap</p><div class="spin"></div>`;
  try {
    const r = await api('/api/matches');
    if (!r.matches.length) {
      root.innerHTML = `
        <h2 class="page-title">ur frens 💜</h2>
        <div class="empty-deck">
          <div class="big">🥺</div>
          <h3>no frens yet</h3>
          <p>double-tap someone from ${esc(state.user.city)} on the feed — or accept a request 💌</p>
          <button class="btn btn-primary" id="go-swipe">🔥 open feed</button>
        </div>`;
      $('#go-swipe').onclick = () => setView('feed');
      return;
    }
    root.innerHTML = `
      <h2 class="page-title">ur frens 💜</h2>
      <p class="page-sub">${r.matches.length} fren${r.matches.length > 1 ? 's' : ''} · tap to yap</p>
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
   EXPLORE 🧭 — vibes · search · trending
   ============================================================ */
let exploreState = { vibe: null, q: '', scope: 'city' };

function renderExplore() {
  const root = $('#view-root');
  root.innerHTML = `
    <div class="explore-head">
      <h2 class="page-title" style="margin-top:14px">explore 🧭</h2>
      <div class="seg" id="ex-scope">
        <button data-s="city" class="on">📍 my city</button>
        <button data-s="india">🇮🇳 all india</button>
      </div>
      <input id="ex-q" placeholder="🔍 search name, @username, city..." autocomplete="off">
    </div>
    <div class="vibe-scroller" id="ex-vibes"><div class="spin"></div></div>
    <div id="ex-results"><div class="spin"></div></div>`;

  $('#ex-scope').querySelectorAll('button').forEach(b => b.onclick = () => {
    exploreState.scope = b.dataset.s;
    root.querySelectorAll('#ex-scope button').forEach(x => x.classList.toggle('on', x === b));
    loadExploreResults();
  });
  let qt;
  $('#ex-q').oninput = (e) => {
    clearTimeout(qt);
    qt = setTimeout(() => { exploreState.q = e.target.value; loadExploreResults(); }, 300);
  };

  api('/api/trending').then(t => {
    const host = $('#ex-vibes');
    if (!host) return;
    const chips = [{ id: null, label: 'all vibes', emoji: '✨' }]
      .concat(t.city.map(x => x.vibe))
      .map(v => `<button class="vchip ${exploreState.vibe === v.id ? 'on' : ''}" data-v="${v.id || ''}">${v.emoji} ${esc(v.label)}</button>`).join('');
    host.innerHTML = `<div class="vibe-row">${chips}</div>`;
    host.querySelectorAll('.vchip').forEach(c => c.onclick = () => {
      exploreState.vibe = c.dataset.v || null;
      host.querySelectorAll('.vchip').forEach(x => x.classList.toggle('on', x === c));
      loadExploreResults();
    });
  }).catch(() => { const h = $('#ex-vibes'); if (h) h.innerHTML = ''; });

  loadExploreResults();
}

async function loadExploreResults() {
  const host = $('#ex-results');
  if (!host) return;
  host.innerHTML = '<div class="spin"></div>';
  try {
    const p = new URLSearchParams();
    if (exploreState.vibe) p.set('vibe', exploreState.vibe);
    if (exploreState.q) p.set('q', exploreState.q);
    p.set('scope', exploreState.scope);
    const r = await api('/api/explore?' + p.toString());
    if (!$('#ex-results')) return;
    if (!r.people.length) {
      host.innerHTML = `<div class="empty-deck" style="padding:40px 10px"><div class="big">🕵️</div><h3 style="font-size:16px">no one found</h3><p>try another vibe or search — or switch to 🇮🇳 all india</p></div>`;
      return;
    }
    host.innerHTML = `
      <p class="page-sub">${r.people.length} ppl${r.onlineCount ? ` · <span class="on-dot">🟢 ${r.onlineCount} online now</span>` : ''}</p>
      <div class="grid2">
        ${r.people.map(u => {
          const shared = (u.vibes || []).filter(v => (state.user.vibes || []).includes(v));
          const topVibes = (u.vibes || []).slice(0, 3).map(id => {
            const v = state.meta.vibeById[id] || state.meta.vibes.find(x => x.id === id);
            return v ? `<span class="chip">${v.emoji}</span>` : '';
          }).join('');
          return `
          <button class="pcard" data-id="${esc(u.id)}" data-name="${esc(u.name)}" data-username="${esc(u.username)}" data-raw='${esc(JSON.stringify(u))}'>
            ${avatarHtml(u, 'pavatar')}
            <div class="pcard-name">${esc(u.name.split(' ')[0])} <span>${u.age}</span></div>
            <div class="pcard-city">📍 ${esc(u.city)}</div>
            <div class="pcard-vibes">${topVibes}</div>
            ${shared.length ? `<div class="pcard-shared">${shared.length} shared vibe${shared.length > 1 ? 's' : ''} ✨</div>` : ''}
          </button>`;
        }).join('')}
      </div>`;
    $$('.pcard', host).forEach(c => c.onclick = () => {
      try { openProfilePeek(JSON.parse(c.dataset.raw)); } catch (x) {}
    });
  } catch (e) {
    host.innerHTML = '<div class="empty-deck"><div class="big">💀</div><p>' + esc(e.message) + '</p></div>';
  }
}

/* profile peek popup from any card */
function openProfilePeek(u) {
  const m = state.meta;
  const photos = u.photos || [];
  const shared = (u.vibes || []).filter(v => (state.user.vibes || []).includes(v));
  const ov = overlayCard(`
    <div class="match-card peek">
      <div class="peek-media" style="background:${gradCss(m, u.avatar.grad)}">
        ${photos[0] ? `<img src="${photos[0]}" alt="">` : `<span class="card-emoji">${esc(u.avatar.emoji)}</span>`}
        <button class="peek-x">✕</button>
        ${u._likesYou || false ? '' : ''}
      </div>
      <div class="peek-body">
        <div class="card-name">${esc(u.name)} <span class="age">${u.age}</span></div>
        <div class="card-loc">@${esc(u.username)} · 📍 ${esc(u.city)} · ${esc(u.gender)}</div>
        ${u.bio ? `<p class="card-bio">${esc(u.bio)}</p>` : ''}
        ${(u.vibes || []).length ? `<div class="chips">${(u.vibes || []).map(id => { const v = m.vibeById[id] || m.vibes.find(x => x.id === id); return v ? `<span class="chip">${v.emoji} ${esc(v.label)}</span>` : ''; }).join('')}</div>` : ''}
        ${shared.length ? `<p class="shared-note">✨ u both vibe with ${shared.map(v => { const vv = m.vibeById[v] || m.vibes.find(x => x.id === v); return vv ? vv.emoji + ' ' + esc(vv.label) : ''; }).join(', ')}</p>` : ''}
        <div class="match-actions" style="margin-top:14px">
          <button class="btn btn-pink btn-block" id="peek-like">💌 send friend request</button>
          <button class="btn btn-ghost btn-block" id="peek-close">close</button>
        </div>
      </div>
    </div>`);
  $('.peek-x', ov).onclick = () => ov.remove();
  $('#peek-close', ov).onclick = () => ov.remove();
  $('#peek-like', ov).onclick = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    try {
      const r = await api('/api/request', { method: 'POST', body: { targetId: u.id } });
      if (r.status === 'mutual') { ov.remove(); confetti(70); state.matchesCount++; showFrensModal(r.match); }
      else { btn.textContent = '⏳ request sent'; btn.disabled = true; toast('friend request sent 💌'); }
    } catch (x) { btn.disabled = false; toast(x.message, 'bad'); }
  };
}

/* ============================================================
   NEARBY 🛰️ (inside explore)
   ============================================================ */
async function renderNearby() {
  const root = $('#view-root');
  root.innerHTML = '<div class="spin"></div>';
  try {
    const r = await api('/api/nearby?radius=100');
    root.innerHTML = `
      <h2 class="page-title" style="margin-top:14px">near u 🛰️</h2>
      <p class="page-sub">${r.onlineCount} online now · ${r.sameCityCount} in ${esc(state.user.city)}</p>
      ${r.onlineNow.length ? `
        <h2 class="page-title" style="font-size:17px">🟢 online now</h2>
        <div class="hscroll">${r.onlineNow.map(u => `
          <button class="ocard" data-raw='${esc(JSON.stringify(u))}'>
            ${avatarHtml(u, 'oavatar')}
            <div class="ocard-n">${esc(u.name.split(' ')[0])}</div>
            <div class="ocard-on">online</div>
          </button>`).join('')}</div>` : '<p class="page-sub">no one online this second — check the feed 💤</p>'}
      <h2 class="page-title" style="font-size:17px">cities near ${esc(state.user.city)}</h2>
      ${r.nearCities.length ? `<div class="chips" style="padding:0 2px">${r.nearCities.map(c => `<span class="chip">📍 ${esc(c.city)} · ${c.users}</span>`).join('')}</div>` : '<p class="page-sub">just u out here so far 😄</p>'}
      <div class="section-gap"></div>`;
    $$('.ocard', root).forEach(c => c.onclick = () => { try { openProfilePeek(JSON.parse(c.dataset.raw)); } catch (x) {} });
  } catch (e) {
    root.innerHTML = '<div class="empty-deck"><div class="big">💀</div><p>' + esc(e.message) + '</p></div>';
  }
}

/* ============================================================
   VIBE CHECK 🎲 — random matchmaker card
   ============================================================ */
async function renderVibeCheck() {
  const root = $('#view-root');
  root.innerHTML = `
    <h2 class="page-title" style="margin-top:14px">vibe check 🎲</h2>
    <p class="page-sub">random matchmaker — could be destiny, could be chaos</p>
    <div id="vc-stage"><div class="spin"></div></div>
    <button class="btn btn-ghost btn-block" id="vc-again" style="margin-top:14px">🎲 someone else</button>`;
  $('#vc-again').onclick = loadVibeCheck;
  await loadVibeCheck();
}

async function loadVibeCheck() {
  const stage = $('#vc-stage');
  if (!stage) return;
  stage.innerHTML = '<div class="spin"></div>';
  try {
    const r = await api('/api/vibe-check');
    if (!r.person) { stage.innerHTML = '<div class="empty-deck"><div class="big">🫙</div><h3>nobody left!</h3></div>'; return; }
    const u = r.person;
    const shared = r.sharedVibes || [];
    stage.innerHTML = `
      <div class="vc-card" style="background:${gradCss(state.meta, u.avatar.grad)}">
        ${u.photos && u.photos[0] ? `<img class="feed-photo" src="${u.photos[0]}" alt="">` : `<span class="card-emoji">${esc(u.avatar.emoji)}</span>`}
        <div class="vc-info">
          <div class="card-name">${esc(u.name)} <span class="age">${u.age}</span></div>
          <div class="card-loc">📍 ${esc(u.city)} · @${esc(u.username)}</div>
          ${shared.length ? `<div class="vc-shared">✨ ${shared.length} shared vibe${shared.length > 1 ? 's' : ''} — destiny fr</div>` : '<div class="vc-shared dim"> opposites attract? lets find out </div>'}
        </div>
      </div>
      <button class="btn btn-pink btn-block" id="vc-like" style="margin-top:12px">💌 vibe check passed — request frenship</button>`;
    $('#vc-like').onclick = (e) => {
      heartBurst(e.clientX, e.clientY);
      sendFriendRequest(u.id);
      setTimeout(loadVibeCheck, 500);
    };
  } catch (e) {
    stage.innerHTML = '<div class="empty-deck"><div class="big">💀</div><p>' + esc(e.message) + '</p></div>';
  }
}

/* ============================================================
   REQUESTS INBOX 💌
   ============================================================ */
async function renderRequests() {
  const root = $('#view-root');
  root.innerHTML = '<h2 class="page-title">requests 💌</h2><div class="spin"></div>';
  try {
    const r = await api('/api/requests');
    state.reqCount = r.incoming.length;
    updateReqBadge();
    const incomingHtml = r.incoming.length ? r.incoming.map(rq => `
      <div class="req-row" id="rq-${esc(rq.id)}">
        ${avatarHtml(rq.user)}
        <div class="match-row-mid">
          <div class="match-row-name">${esc(rq.user.name)} <span class="muted-dim">${rq.user.age} · ${esc(rq.user.city)}</span></div>
          <div class="match-row-last">@${esc(rq.user.username)} wants to be ur fren</div>
        </div>
        <div class="req-actions">
          <button class="req-btn yes" data-id="${esc(rq.id)}" title="accept">✓</button>
          <button class="req-btn no" data-id="${esc(rq.id)}" title="reject">✕</button>
        </div>
      </div>`).join('') : `
      <div class="empty-deck" style="padding:34px 10px">
        <div class="big">📬</div>
        <h3 style="font-size:16px">no requests yet</h3>
        <p>when someone double-taps u, they land here 😎</p>
      </div>`;
    const sentHtml = r.sent.length ? `
      <h2 class="page-title" style="font-size:17px">sent by u ⏳</h2>
      ${r.sent.map(rq => `
        <div class="req-row dim">
          ${avatarHtml(rq.user)}
          <div class="match-row-mid">
            <div class="match-row-name">${esc(rq.user.name)} <span class="muted-dim">${rq.user.age} · ${esc(rq.user.city)}</span></div>
            <div class="match-row-last">waiting for their answer…</div>
          </div>
          <span class="match-row-time">⏳</span>
        </div>`).join('')}` : '';
    root.innerHTML = `
      <h2 class="page-title">requests 💌</h2>
      <p class="page-sub">they liked u — ur call bestie</p>
      ${incomingHtml}
      ${sentHtml}
      <div class="section-gap"></div>`;
    $$('.req-btn.yes', root).forEach(b => b.onclick = () => decideRequest(b.dataset.id, 'accept'));
    $$('.req-btn.no', root).forEach(b => b.onclick = () => decideRequest(b.dataset.id, 'reject'));
  } catch (e) {
    root.innerHTML = '<div class="empty-deck"><div class="big">💀</div><h3>couldn&apos;t load</h3><p>' + esc(e.message) + '</p></div>';
  }
}

async function decideRequest(id, action) {
  try {
    const r = await api('/api/requests/' + encodeURIComponent(id) + '/' + action, { method: 'POST', body: {} });
    const row = document.getElementById('rq-' + CSS.escape(id));
    if (row) {
      row.style.transition = 'all .3s';
      row.style.opacity = '0';
      row.style.transform = 'translateX(' + (action === 'accept' ? '40px' : '-40px') + ')';
      setTimeout(() => row.remove(), 300);
    }
    if (action === 'accept') {
      catAnimation('happy');
      confetti(50);
      state.matchesCount++;
      state.reqCount = Math.max(0, state.reqCount - 1);
      updateReqBadge();
      toast('u and ' + r.match.user.name + ' are frens now 🎉', 'good');
      const ov = overlayCard(`
        <div class="match-card" style="max-width:330px">
          <div class="match-title" style="font-size:26px">FRENSSS!! 🎉</div>
          <p class="match-sub">u and ${esc(r.match.user.name)} can yap now</p>
          <div class="match-actions">
            <button class="btn btn-primary btn-block" id="fr-chat">say hi 👋</button>
            <button class="btn btn-ghost btn-block" id="fr-later">later</button>
          </div>
        </div>`);
      $('#fr-chat', ov).onclick = async () => { ov.remove(); state.view = 'matches'; renderNav(); await openChat(r.match.id, r.match.user); };
      $('#fr-later', ov).onclick = () => ov.remove();
    } else {
      catAnimation('sad');
      state.reqCount = Math.max(0, state.reqCount - 1);
      updateReqBadge();
      toast('request rejected ✕');
    }
    await loadMe();
  } catch (e) { toast(e.message, 'bad'); }
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
        ${u.photo ? `<img class="card-photo" src="${u.photo}" alt="">` : `<span class="card-emoji" id="me-emoji">${esc(u.avatar.emoji)}</span>`}
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
      <div id="photo-field-host"></div>
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

  profileDraft.photos = [...(u.photos || (u.photo ? [u.photo] : []))];
  const syncCover = () => {
    const media = $('#me-media');
    if (profileDraft.photos[0]) { media.innerHTML = `<img class="card-photo" src="${profileDraft.photos[0]}" alt="">`; }
    else { media.innerHTML = `<span class="card-emoji" id="me-emoji">${esc(profileDraft.emoji)}</span>`; }
  };
  const rerenderPics = (arr) => {
    profileDraft.photos = arr;
    renderPhotoField(arr, rerenderPics);
    syncCover();
  };
  renderPhotoField(profileDraft.photos, rerenderPics);
  const syncPreview = () => {
    if (!profileDraft.photos[0]) {
      const em = $('#me-emoji');
      if (em) em.textContent = profileDraft.emoji;
    }
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
          vibes: profileDraft.vibes, avatar: { emoji: profileDraft.emoji, grad: profileDraft.grad },
          photos: profileDraft.photos
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
        <div class="stat-card pink"><b>${s.matches}</b><span>frens made</span></div>
        <div class="stat-card"><b>${s.requests.sent}</b><span>⏳ pending reqs</span></div>
        <div class="stat-card cyan"><b>${s.requests.accepted}</b><span>✓ accepted</span></div>
        <div class="stat-card pink"><b>${s.requests.rejected}</b><span>✕ rejected</span></div>
        <div class="stat-card cyan"><b>${s.messages}</b><span>messages sent</span></div>
        <div class="stat-card purple"><b>${s.signupsWeek}</b><span>signups (7d)</span></div>
      </div>

      <h2 class="page-title" style="font-size:17px">email delivery 📧</h2>
      <p class="page-sub" id="mail-status">loading…</p>
      <div class="mail-card">
        <div class="mail-steps">
          <b>how to get ur app password (2 mins):</b>
          <ol>
            <li>go to <b>myaccount.google.com</b> → <b>security</b></li>
            <li>turn <b>2-step verification ON</b> (needed for app passwords)</li>
            <li>search <b>"App passwords"</b> in the search bar → create one (name: frfr)</li>
            <li>Google shows a <b>16-character password</b> — paste both below 👇</li>
          </ol>
          <span class="muted-dim">codes get sent from <b>ur gmail</b> to users' inboxes. the app password is stored only in this app's data file on ur machine.</span>
        </div>
        <div class="frow">
          <div class="field"><label>ur gmail</label><input id="mail-gmail" placeholder="you@gmail.com" autocomplete="off"></div>
          <div class="field"><label>app password (16 chars)</label><input id="mail-pass" type="password" placeholder="abcd efgh ijkl mnop" autocomplete="off"></div>
        </div>
        <div class="err-line" id="mail-err"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="mail-save">💾 save & use gmail</button>
          <button class="btn btn-ghost btn-sm" id="mail-test">📨 send test email</button>
          <button class="btn btn-ghost btn-sm" id="mail-clear">🧪 back to demo mode</button>
        </div>
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
        <thead><tr><th>who</th><th>@user</th><th>city</th><th>age</th><th>type</th><th>reqs</th><th>frens</th><th>msgs</th><th>joined</th><th></th></tr></thead>
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
          <td>${u.reqs}</td>
          <td>${u.matches}</td>
          <td>${u.msgs}</td>
          <td>${timeAgo(u.createdAt)}</td>
          <td style="white-space:nowrap"><button class="edit-btn" data-id="${esc(u.id)}">✏️ edit</button> <button class="del-btn" data-id="${esc(u.id)}" data-name="${esc(u.name)}">delete</button></td>
        </tr>`).join('') || `<tr><td colspan="10" class="muted-dim" style="text-align:center;padding:24px">no users match "${esc(t)}"</td></tr>`;
      $$('#admin-rows .edit-btn').forEach(b => b.onclick = () => {
        const u = adminRows.find(x => x.id === b.dataset.id);
        if (u) editUserModal(u);
      });
      $$('#admin-rows .del-btn').forEach(b => b.onclick = () => deleteUser(b.dataset.id, b.dataset.name));
    };
    drawRows('');
    $('#admin-q').oninput = (e) => drawRows(e.target.value);
    $('#admin-refresh').onclick = () => renderAdmin();

    // ---- email delivery wiring ----
    const mailStatus = $('#mail-status');
    try {
      const mc = await api('/api/admin/mail');
      mailStatus.innerHTML = mc.mode === 'gmail'
        ? '<span class="mail-pill on">✉️ gmail connected — codes send from ' + esc(mc.user) + '</span>'
        : '<span class="mail-pill">🧪 demo mode — codes shown on screen only (no mail key)</span>';
      if (mc.user) $('#mail-gmail').value = mc.user;
    } catch (x) {
      mailStatus.innerHTML = '<span class="mail-pill">🧪 demo mode</span>';
    }
    $('#mail-save').onclick = async () => {
      const err = $('#mail-err'); err.textContent = '';
      try {
        await api('/api/admin/mail', { method: 'POST', body: { gmail: $('#mail-gmail').value, appPass: $('#mail-pass').value } });
        toast('gmail delivery saved 📧', 'good');
        renderAdmin();
      } catch (x) { err.textContent = x.message; }
    };
    $('#mail-test').onclick = async () => {
      const err = $('#mail-err'); err.textContent = '';
      const btn = $('#mail-test'); btn.disabled = true; btn.textContent = 'sending…';
      try {
        const r = await api('/api/admin/mail/test', { method: 'POST', body: { to: $('#mail-gmail').value } });
        if (r.ok) { toast('test email sent to ' + r.to + ' 📨 check inbox!', 'good'); err.textContent = ''; }
        else err.textContent = 'send failed: ' + r.error;
      } catch (x) { err.textContent = x.message; }
      btn.disabled = false; btn.textContent = '📨 send test email';
    };
    $('#mail-clear').onclick = async () => {
      try {
        await api('/api/admin/mail/clear', { method: 'POST', body: {} });
        toast('back to demo mode 🧪');
        renderAdmin();
      } catch (x) { toast(x.message, 'bad'); }
    };
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

/* ---------------------------------------------------- admin: edit user */
function editUserModal(u) {
  const m = state.meta;
  const cities = m.cities.map(c => `<option value="${esc(c)}">`).join('');
  const ov = overlayCard(`
    <div class="match-card admin-edit">
      <div class="match-title" style="font-size:24px">edit @${esc(u.username)} ✏️</div>
      <p class="match-sub">changes save instantly to their account</p>
      <form id="eu-form">
        <div class="frow">
          <div class="field"><label>name</label><input name="name" maxlength="24" value="${esc(u.name)}"></div>
          <div class="field"><label>username</label><input name="username" maxlength="16" value="${esc(u.username)}"></div>
        </div>
        <div class="field"><label>email</label><input name="email" type="email" value="${esc(u.email)}"></div>
        <div class="frow">
          <div class="field"><label>new password <span style="text-transform:none;letter-spacing:0">(blank = keep)</span></label><input name="password" type="text" placeholder="min 6 chars"></div>
          <div class="field"><label>city</label><input name="city" list="eu-cities" value="${esc(u.city)}"><datalist id="eu-cities">${cities}</datalist></div>
        </div>
        <div class="frow">
          <div class="field"><label>age</label><input name="age" type="number" min="13" max="19" value="${u.age}"></div>
          <div class="field"><label>i'm a...</label>
            <select name="gender">${m.genders.map(g => `<option value="${esc(g)}" ${g === u.gender ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="field"><label>bio</label><textarea name="bio" maxlength="220">${esc(u.bio)}</textarea></div>
        <div class="field"><label>vibes (max 5)</label><div class="vibe-grid" id="eu-vibes">
          ${m.vibes.map(v => `<button type="button" class="vibe-pick ${(u.vibes || []).includes(v.id) ? 'on' : ''}" data-vibe="${v.id}">${v.emoji} ${esc(v.label)}</button>`).join('')}
        </div></div>
        <div class="field"><label>profile pic</label>
          <div class="photo-row">
            <div class="photo-preview ${u.photo ? 'has' : ''}" id="eu-prev" style="${u.photo ? `background-image:url('${u.photo}')` : ''}">${u.photo ? '' : '😕'}</div>
            <div class="photo-btns">
              <button type="button" class="btn btn-ghost btn-sm" id="eu-photo-btn">📷 set pic</button>
              <button type="button" class="btn btn-ghost btn-sm" id="eu-photo-del">🗑 remove</button>
            </div>
          </div>
          <input type="file" id="eu-photo-file" accept="image/*" hidden>
        </div>
        <div class="err-line" id="eu-err"></div>
        <div style="display:flex;gap:10px;margin-top:6px">
          <button class="btn btn-primary" type="submit" style="flex:1">save changes ✌️</button>
          <button class="btn btn-ghost" type="button" id="eu-cancel">cancel</button>
        </div>
      </form>
    </div>`);

  const vibes = [...(u.vibes || [])];
  $$('#eu-vibes .vibe-pick', ov).forEach(b => b.onclick = () => {
    const id = b.dataset.vibe;
    if (vibes.includes(id)) { vibes.splice(vibes.indexOf(id), 1); b.classList.remove('on'); }
    else if (vibes.length < 5) { vibes.push(id); b.classList.add('on'); }
    else toast('max 5 vibes', 'bad');
  });

  let photo = (u.photos && u.photos[0]) || u.photo || null;
  $('#eu-photo-btn', ov).onclick = () => $('#eu-photo-file', ov).click();
  $('#eu-photo-file', ov).onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      pickPhoto(e.target.files[0], (durl) => {
        photo = durl;
        const p = $('#eu-prev', ov);
        p.style.backgroundImage = `url('${durl}')`; p.classList.add('has'); p.textContent = '';
      });
    }
  };
  $('#eu-photo-del', ov).onclick = () => {
    photo = null;
    const p = $('#eu-prev', ov);
    p.style.backgroundImage = ''; p.classList.remove('has'); p.textContent = '😕';
  };

  $('#eu-cancel', ov).onclick = () => ov.remove();
  $('#eu-form', ov).onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get('name'), username: fd.get('username'), email: fd.get('email'),
      city: fd.get('city'), age: fd.get('age'), gender: fd.get('gender'),
      bio: fd.get('bio'), vibes, photo
    };
    const pw = String(fd.get('password') || '');
    if (pw) body.password = pw;
    try {
      await api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: 'PUT', body });
      toast('@' + u.username + ' updated ✌️', 'good');
      ov.remove();
      renderAdmin();
    } catch (ex) { $('#eu-err', ov).textContent = ex.message; }
  };
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
      setView('feed');
      return;
    } catch { /* token dead — landing */ }
  }
  renderLanding();
}

boot();
