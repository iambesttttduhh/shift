'use strict';
/*
 *  frfr — make frens in ur city ✦
 *  Zero-dependency Node.js server: static files + JSON API + JSON-file persistence.
 *  Run:  node server.js   (then open http://localhost:3000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');

/* ------------------------------------------------------------------ config */
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.FRFR_DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

/* --------------------------------------------------------------- constants */
const CITIES = [
  'Mumbai', 'New Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune',
  'Jaipur', 'Lucknow', 'Ahmedabad', 'Indore', 'Bhopal', 'Chandigarh', 'Kochi',
  'Surat', 'Nagpur', 'Goa', 'Guwahati', 'Patna', 'Ranchi', 'Varanasi',
  'Amritsar', 'Dehradun', 'Mysuru', 'Nashik', 'Rajkot', 'Coimbatore',
  'Visakhapatnam', 'Bhubaneswar', 'Thiruvananthapuram', 'Kanpur', 'Agra',
  'Noida', 'Gurugram', 'Shimla', 'Jodhpur', 'Udaipur', 'Vadodara', 'Madurai',
  'Mangaluru'
];

const CITY_ALIASES = {
  bombay: 'Mumbai', delhi: 'New Delhi', bangalore: 'Bengaluru', bengaluru: 'Bengaluru',
  gurgaon: 'Gurugram', cochin: 'Kochi', madras: 'Chennai', calcutta: 'Kolkata',
  trivandrum: 'Thiruvananthapuram', vizag: 'Visakhapatnam', mysore: 'Mysuru',
  baroda: 'Vadodara', poona: 'Pune', banaras: 'Varanasi', benaras: 'Varanasi',
  tvl: 'Thiruvananthapuram', tvm: 'Thiruvananthapuram', ncr: 'New Delhi'
};

const VIBES = [
  { id: 'music',   label: 'Music',      emoji: '🎧' },
  { id: 'gaming',  label: 'Gaming',     emoji: '🎮' },
  { id: 'cricket', label: 'Cricket',    emoji: '🏏' },
  { id: 'football',label: 'Football',   emoji: '⚽' },
  { id: 'study',   label: 'Study buddy',emoji: '📚' },
  { id: 'foodie',  label: 'Foodie',     emoji: '🍕' },
  { id: 'travel',  label: 'Travel',     emoji: '✈️' },
  { id: 'movies',  label: 'Movies',     emoji: '🎬' },
  { id: 'singing', label: 'Singing',    emoji: '🎤' },
  { id: 'dance',   label: 'Dance',      emoji: '💃' },
  { id: 'art',     label: 'Art',        emoji: '🎨' },
  { id: 'photos',  label: 'Photography',emoji: '📸' },
  { id: 'cafe',    label: 'Cafe hopping',emoji: '☕' },
  { id: 'boba',    label: 'Bubble tea', emoji: '🧋' },
  { id: 'badminton',label: 'Badminton', emoji: '🏸' },
  { id: 'coding',  label: 'Coding',     emoji: '💻' },
  { id: 'books',   label: 'Books',      emoji: '📖' },
  { id: 'dogs',    label: 'Dogs',       emoji: '🐶' },
  { id: 'cats',    label: 'Cats',       emoji: '🐱' },
  { id: 'skating', label: 'Skating',    emoji: '🛹' },
  { id: 'guitar',  label: 'Guitar',     emoji: '🎸' },
  { id: 'beach',   label: 'Beach',      emoji: '🌊' },
  { id: 'trek',    label: 'Mountains',  emoji: '⛰️' },
  { id: 'anime',   label: 'Anime',      emoji: '🍥' }
];

const EMOJIS = ['😎','🔥','🐼','🦋','🌸','🦁','🐯','🐨','⚡','🌙','⭐','🍄','🐸','🦄','🐬','🍒','👑','🤠','🥷','🐙','🦖','🌵','🍀','🎧'];

const GRADS = [
  ['#ff4d8d', '#8b5cf6'],
  ['#ccff33', '#22d3a7'],
  ['#5eead4', '#3b82f6'],
  ['#fbbf24', '#ff4d8d'],
  ['#a78bfa', '#5eead4'],
  ['#ff8a5c', '#ff2e63'],
  ['#22d3ee', '#818cf8'],
  ['#f472b6', '#fbbf24']
];

const GENDERS = ['girl', 'boy', 'non-binary', 'prefer not to say'];

/* demo-fren portrait pool (bundled, AI-generated, cached by browser) */
const BOT_PICS = {
  boy: ['/pics/teen01.jpg', '/pics/teen03.jpg', '/pics/teen05.jpg', '/pics/teen07.jpg', '/pics/teen09.jpg'],
  girl: ['/pics/teen02.jpg', '/pics/teen04.jpg', '/pics/teen06.jpg', '/pics/teen08.jpg', '/pics/teen10.jpg']
};
function botPhotos(gender, seedStr) {
  const pool = BOT_PICS[gender === 'girl' ? 'girl' : 'boy'];
  let h = 0;
  for (const ch of String(seedStr)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const first = pool[h % pool.length];
  const photos = [first];
  if (h % 3 === 0) {
    const second = pool[(h + 1 + Math.floor(h / 7)) % pool.length];
    if (second !== first) photos.push(second);
  }
  return photos;
}

/* ------------------------------------------------------------------- utils */
const uuid = () => crypto.randomUUID();

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(pw, salt, hash) {
  try {
    const h = crypto.scryptSync(String(pw), salt, 64);
    return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
  } catch { return false; }
}

function normalizeCity(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  const low = t.toLowerCase();
  if (CITY_ALIASES[low]) return CITY_ALIASES[low];
  const hit = CITIES.find(c => c.toLowerCase() === low);
  if (hit) return hit;
  // accept unknown cities, prettily title-cased
  return low.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function titleCaseName(s) {
  return s.trim().replace(/\s+/g, ' ').split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const EMAIL_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@gmail\.com$/i;
/* one-mailbox-per-account: strip +tags, ignore gmail dots, lowercase */
function normalizeEmailKey(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  const local = e.slice(0, at).split('+')[0];
  const dom = e.slice(at + 1);
  return (dom === 'gmail.com' ? local.replace(/\./g, '') : local) + '@' + dom;
}
const PHOTO_MAX = 300000; // ~300KB dataURL cap (client resizes before upload)

function validPhoto(p) {
  return typeof p === 'string' && p.startsWith('data:image/') && p.length <= PHOTO_MAX;
}

/* ---------------- email verification (4-digit code) ---------------- */
const VERIF_EXPIRE = 10 * 60 * 1000;   // code valid 10 min
const VERIF_COOLDOWN = 45 * 1000;      // resend cooldown
const VERIF_MAX_ATTEMPTS = 6;
const pendingVerifs = new Map();       // pendingToken -> { userId, at } (in-memory)

function hashCode(uidv, code) {
  return crypto.createHash('sha256').update(uidv + ':' + code).digest('hex');
}
function makeCode() { return String(crypto.randomInt(1000, 10000)); }

function mailHtml(name, code) {
  return `<div style="font-family:Arial,sans-serif;background:#0a0a0f;color:#f4f4ef;padding:32px;border-radius:16px">
    <h2 style="color:#ccff33">hey ${name} 👋</h2>
    <p>ur frfr verification code is:</p>
    <p style="font-size:42px;font-weight:900;letter-spacing:12px;color:#ccff33">${code}</p>
    <p style="color:#9a9aae">expires in 10 minutes. dont share it with anyone fr 🤫</p>
  </div>`;
}

/* getMailConfig: gmail SMTP (db) → gmail SMTP (env) → resend → demo */
function getMailConfig() {
  db.settings = db.settings || {};
  const s = db.settings.mail || {};
  if (s.user && s.appPass) return { mode: 'gmail', user: s.user, pass: s.appPass, host: 'smtp.gmail.com', port: 587 };
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) return { mode: 'gmail', user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS, host: 'smtp.gmail.com', port: 587 };
  if (process.env.RESEND_API_KEY) return { mode: 'resend' };
  return { mode: 'demo' };
}

/* minimal zero-dependency SMTP client (STARTTLS + AUTH PLAIN) */
function smtpSendMail({ host, port = 587, user, pass, from, to, subject, html, skipTls = false }) {
  return new Promise((resolve, reject) => {
    let sock;
    let buf = '';
    let pending = [];
    let step = 'greet';
    let done = false;
    const timer = setTimeout(() => fail(new Error('smtp timeout — no answer from ' + host)), 15000);
    const fail = (e) => { if (done) return; done = true; clearTimeout(timer); try { sock && sock.destroy(); } catch (x) {} reject(e); };
    const ok = () => { if (done) return; done = true; clearTimeout(timer); try { sock.write('QUIT\r\n'); setTimeout(() => { try { sock.end(); } catch (x) {} }, 120); } catch (x) {} resolve({ queued: true }); };
    const send = (s) => sock.write(s + '\r\n');

    const sendAuth = () => {
      const secret = Buffer.concat([Buffer.from([0]), Buffer.from(user), Buffer.from([0]), Buffer.from(pass)]).toString('base64');
      step = 'auth'; send('AUTH PLAIN ' + secret);
    };
    const upgradeTls = () => {
      sock.removeListener('data', onRaw);
      const up = tls.connect({ socket: sock, servername: host, rejectUnauthorized: false }, () => {
        sock = up;
        attach(up);
        step = 'ehlo2';
        send('EHLO frfr.local');
      });
      up.on('error', fail);
    };
    const handle = (code, full) => {
      switch (step) {
        case 'greet': if (code !== 220) return fail(new Error('smtp greeting ' + code)); step = 'ehlo'; send('EHLO frfr.local'); break;
        case 'ehlo': if (code !== 250) return fail(new Error('EHLO rejected: ' + full)); if (skipTls) sendAuth(); else { step = 'starttls'; send('STARTTLS'); } break;
        case 'starttls': if (code !== 220) return fail(new Error('STARTTLS rejected: ' + full)); upgradeTls(); break;
        case 'ehlo2': if (code !== 250) return fail(new Error('EHLO2 rejected: ' + full)); sendAuth(); break;
        case 'auth': if (code !== 235) return fail(new Error('auth rejected — check the app password (' + code + ')')); step = 'mail'; send('MAIL FROM:<' + from + '>'); break;
        case 'mail': if (code !== 250) return fail(new Error('MAIL FROM rejected: ' + full)); step = 'rcpt'; send('RCPT TO:<' + to + '>'); break;
        case 'rcpt': if (code !== 250) return fail(new Error('recipient rejected: ' + full)); step = 'data'; send('DATA'); break;
        case 'data': if (code !== 354) return fail(new Error('DATA rejected: ' + full)); {
          const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
          const body = b64(html).replace(/(.{76})/g, '$1\r\n');
          const msg =
            'From: frfr <' + from + '>\r\n' +
            'To: <' + to + '>\r\n' +
            'Subject: =?UTF-8?B?' + b64(subject) + '?=\r\n' +
            'MIME-Version: 1.0\r\n' +
            'Content-Type: text/html; charset=UTF-8\r\n' +
            'Content-Transfer-Encoding: base64\r\n\r\n' + body + '\r\n.';
          send(msg);
          step = 'dot';
          break;
        }
        case 'dot': if (code !== 250) return fail(new Error('message rejected: ' + full)); ok(); break;
        default: break;
      }
    };
    const onLine = (line) => {
      pending.push(line);
      const m = /^(\d{3})([ -])/.exec(line);
      if (!m) return;
      if (m[2] === '-') return;
      const code = parseInt(m[1], 10);
      const full = pending.join(' | '); pending = [];
      try { handle(code, full); } catch (e) { fail(e); }
    };
    const onRaw = (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        onLine(line);
        if (done) return;
      }
    };
    const attach = (s) => {
      s.on('data', onRaw);
      s.on('error', fail);
      s.on('close', () => { if (!done) fail(new Error('connection closed early')); });
    };
    sock = net.connect({ host, port });
    attach(sock);
  });
}

async function sendVerificationEmail(email, name, code) {
  const cfg = getMailConfig();
  if (cfg.mode === 'gmail') {
    try {
      await smtpSendMail({ host: cfg.host, port: cfg.port, user: cfg.user, pass: cfg.pass, from: cfg.user, to: email, subject: code + ' is ur frfr verification code', html: mailHtml(name, code) });
      console.log('[frfr] GMAIL MAIL → ' + email + ' (via ' + cfg.user + ')');
      return 'gmail';
    } catch (e) {
      console.error('[frfr] gmail send failed:', e.message, '→ falling back to demo');
    }
  }
  if (cfg.mode === 'resend') {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'frfr <onboarding@resend.dev>', to: [email], subject: code + ' is ur frfr verification code', html: mailHtml(name, code) })
      });
      if (!r.ok) { console.error('[frfr] resend failed:', r.status, await r.text().catch(() => '')); }
      else { console.log('[frfr] RESEND MAIL → ' + email); return 'resend'; }
    } catch (e) { console.error('[frfr] resend error:', e.message); }
  }
  console.log('[frfr] DEMO MAIL → ' + email + ' code: ' + code + ' (configure Gmail in admin panel for real emails)');
  return 'demo';
}

function issueVerification(user) {
  const code = makeCode();
  db.verifications = db.verifications || {};
  db.verifications[user.id] = {
    codeHash: hashCode(user.id, code),
    expires: Date.now() + VERIF_EXPIRE,
    attempts: 0,
    lastSent: Date.now()
  };
  saveDb();
  return sendVerificationEmail(user.email, user.name, code).then(mode => {
    const pending = crypto.randomBytes(24).toString('hex');
    pendingVerifs.set(pending, { userId: user.id, at: Date.now() });
    return { mode, pending, code };
  });
}

function checkVerification(user, code) {
  const v = (db.verifications || {})[user.id];
  if (!v) return { ok: false, msg: 'no code pending — hit resend 📬' };
  if (Date.now() > v.expires) return { ok: false, msg: 'code expired bestie — resend it 📬' };
  if (v.attempts >= VERIF_MAX_ATTEMPTS) return { ok: false, msg: 'too many tries 💀 hit resend' };
  v.attempts++;
  if (String(code).trim() !== '' && hashCode(user.id, String(code).trim()) === v.codeHash) {
    user.emailVerified = true;
    delete db.verifications[user.id];
    saveDb();
    return { ok: true };
  }
  saveDb();
  return { ok: false, msg: 'wrong code 🙅 check again' };
}
const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

/* ---------------------------------------------------------------- database */
let db = null;
let saveTimer = null;

function emptyDb() {
  return { users: [], swipes: [], matches: [], messages: [], sessions: {}, requests: [], lobbies: [], settings: {}, meta: { createdAt: Date.now() } };
}

function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch { db = null; }
  if (!db || !Array.isArray(db.users)) {
    db = emptyDb();
    seedAdmin();
    seedBots();
    saveDbNow();
    console.log('[frfr] fresh db seeded:', db.users.length, 'users');
  }
  // migration: accounts from before v1.7 are grandfathered as verified
  let migrated = 0;
  for (const u of db.users) {
    if (u.emailVerified === undefined) { u.emailVerified = true; migrated++; }
    if (!Array.isArray(u.photos)) u.photos = u.photo ? [u.photo] : []; // v1.8: photo galleries
    if (!u.emailKey) { u.emailKey = normalizeEmailKey(u.email); migrated++; } // v1.10: mailbox key
    if (u.xp === undefined) { u.xp = 0; u.level = 1; u.streak = { count: 0, last: null, best: 0 }; }
    if (u.isBot && !(u.photos && u.photos.length)) { // v2.2: portraits for demo frens
      u.photos = botPhotos(u.gender, u.username);
      if (!u.photo) u.photo = u.photos[0];
      migrated++;
    }
  }
  if (!Array.isArray(db.requests)) db.requests = []; // v1.8: friend requests
  if (migrated) { saveDbNow(); console.log('[frfr] migration: verified', migrated, 'existing accounts'); }
}

function saveDbNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_PATH);
  } catch (e) { console.error('[frfr] save failed', e.message); }
}
function saveDb() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveDbNow(); }, 400);
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { saveDbNow(); process.exit(0); });
}

/* --------------------------------------------------------------------- ids */
let idc = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}${(idc++).toString(36)}${crypto.randomBytes(3).toString('hex')}`;

/* -------------------------------------------------------------- seed: admin */
function seedAdmin() {
  const { salt, hash } = hashPassword('admin123');
  db.users.push({
    id: 'user_admin', role: 'admin', emailVerified: true,
    name: 'frfr Admin', username: 'admin', email: 'admin@frfr.app',
    passSalt: salt, passHash: hash,
    age: 19, city: 'New Delhi', gender: 'prefer not to say',
    bio: 'i keep this place safe fr 🛡️ hmu if u find bugs',
    vibes: ['coding', 'music'],
    avatar: { emoji: '🛡️', grad: 0 },
    isBot: false, createdAt: Date.now()
  });
}

/* -------------------------------------------------------------- seed: bots */
const BOT_NAMES = [
  ['Aarav','boy'],['Ananya','girl'],['Kabir','boy'],['Zoya','girl'],['Vihaan','boy'],['Diya','girl'],
  ['Ishaan','boy'],['Myra','girl'],['Arjun','boy'],['Sana','girl'],['Aditya','boy'],['Priya','girl'],
  ['Neel','boy'],['Tara','girl'],['Dev','boy'],['Kiara','girl'],['Aryan','boy'],['Riya','girl'],
  ['Reyansh','boy'],['Aisha','girl'],['Dhruv','boy'],['Anika','girl'],['Karan','boy'],['Naina','girl'],
  ['Rohan','boy'],['Ira','girl'],['Veer','boy'],['Meher','girl'],['Advait','boy'],['Pihu','girl'],
  ['Yash','boy'],['Simran','girl'],['Omkar','boy'],['Kavya','girl'],['Atharv','boy'],['Jasleen','girl'],
  ['Parth','boy'],['Alisha','girl'],['Nikhil','boy'],['Trisha','girl'],['Samar','boy'],['Amaira','girl'],
  ['Abhay','boy'],['Rhea','girl'],['Lakshya','boy'],['Suhana','girl'],['Manav','boy'],['Tanya','girl'],
  ['Harsh','boy'],['Ishita','girl'],['Sahil','boy'],['Mehak','girl'],['Rishi','boy'],['Nyra','girl'],
  ['Ayush','boy'],['Prisha','girl'],['Kunal','boy'],['Avni','girl'],['Shaurya','boy'],['Alia','girl']
];

const BOT_BIOS = [
  'professional yapper 🗣️ hmu if u can match my energy',
  'chai > coffee. fight me on this and ur blocked ☕',
  'cricket is my whole personality 🏏 gully cricket legend',
  'bgmi grind never stops 🎮 drop ur id',
  'looking for a badminton duo who wont judge my serves 🏸',
  'kpop stash bigger than my syllabus 💜',
  'anime recommendations = my love language 🍥',
  'street food tour partner needed. i know all the best stalls 🌮',
  'mid at guitar, elite at humming 🎸',
  'study buddy who actually studies (rare find fr) 📚',
  'i yap, u listen. deal? 😌',
  'cafe hopping and judging the latte art ☕✍️',
  'weekend treks > weekend reels ⛰️',
  'made 47 reels this month, 3 hit the fyp 📸',
  'cheese burst pizza is my soulmate 🍕',
  'gym at 6am (i actually go at 10) 💪',
  'tbr pile taller than me, send help 📖',
  'cat person. dogs are cool too. dont make me choose 🐱',
  'bollywood dialogues for every situation, try me 🎬',
  'skating to tuition coz main character energy 🛹',
  'spam me with memes, thats the friendship test 😹',
  'beach days and sunset pics 🌊',
  'i peak in ludo king 👑 undefeated',
  'vibe curator. playlist maker. aux holder 🎧',
  'chess.com addict, accept my challenge ♟️',
  'debate club champ, argue with me (respectfully) 🔥',
  'plant parent, my room is a jungle 🌿',
  'sunday = cycling + chai + zero notifications 🚴',
  'standup comedy nerd, laugh at my jokes or else 🎤',
  'photography page with 200 followers, we grow 📷',
  'maths topper, drama queen, chaos incarnate ✨',
  'football watch parties at my place, bring snacks ⚽',
  'im the friend who says 5 more mins and means 2 hours ⏰',
  'writing a novel. on chapter 1 since 2024 ✍️',
  'dancing like nobodys watching (pls dont watch) 💃',
  'bubble tea connoisseur, boba runs every friday 🧋',
  'coding till 3am, regretting at 7am 💻',
  'will bring speaker to the picnic, thats my thing 🔊'
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function seedBots() {
  const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  let ni = 0;
  const usedUsernames = new Set(db.users.map(u => u.username.toLowerCase()));
  for (const city of CITIES) {
    const count = randInt(4, 6);
    for (let i = 0; i < count; i++) {
      const [name, gender] = shuffledNames[(ni++) % shuffledNames.length];
      let username = (name + randInt(10, 99)).toLowerCase();
      while (usedUsernames.has(username)) username = (name + randInt(100, 999)).toLowerCase();
      usedUsernames.add(username);
      const vibes = [...VIBES].sort(() => Math.random() - 0.5).slice(0, randInt(2, 4)).map(v => v.id);
      // pre-baked unusable hash (no per-bot scrypt => instant startup)
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.randomBytes(64).toString('hex');
      db.users.push({
        id: uid('u'), role: 'user',
        name, username, email: `${username}@frfrdemo.in`,
        passSalt: salt, passHash: hash,
        age: randInt(13, 19), city,
        gender,
        bio: pick(BOT_BIOS),
        vibes,
        avatar: { emoji: pick(EMOJIS), grad: randInt(0, GRADS.length - 1) },
        photos: botPhotos(gender, username),
        isBot: true, emailVerified: true,
        createdAt: Date.now() - randInt(1, 60) * 86400000
      });
    }
  }
}

/* ----------------------------------------------------------------- helpers */
function findUser(id) { return db.users.find(u => u.id === id); }
function findUserByUsernameOrEmail(x) {
  const t = String(x || '').trim().toLowerCase();
  const k = normalizeEmailKey(t);
  return db.users.find(u => u.username.toLowerCase() === t || u.email.toLowerCase() === t || (u.emailKey && u.emailKey === k));
}

function publicUser(u, { withEmail = false, noPhoto = false } = {}) {
  if (!u) return null;
  const photos = Array.isArray(u.photos) ? u.photos : (u.photo ? [u.photo] : []);
  const out = {
    id: u.id, name: u.name, username: u.username, age: u.age, city: u.city,
    gender: u.gender, bio: u.bio || '', vibes: u.vibes || [], avatar: u.avatar,
    photo: noPhoto ? null : (u.photo || null),
    photos: noPhoto ? [] : photos,
    role: u.role, isBot: !!u.isBot, createdAt: u.createdAt,
    lastSeen: u.lastSeen || u.createdAt || 0
  };
  if (withEmail) out.email = u.email;
  return out;
}

function pairKey(a, b) { return [a, b].sort().join('::'); }
function existingMatch(a, b) {
  return db.matches.find(m => m.pair === pairKey(a, b));
}
function swipeBetween(from, to) {
  return db.swipes.find(s => s.from === from && s.to === to);
}

/* ------------------------------------------------------------------ routes */
const routes = [];
function addRoute(method, pattern, opts, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
  routes.push({ method, regex, keys, opts: opts || {}, handler });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}
const bad = (res, msg, code = 400) => sendJson(res, code, { error: msg });

function authUser(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const userId = db.sessions[m[1]];
  return userId ? findUser(userId) : null;
}

/* ------------------------------------------------------------- api: public */
addRoute('GET', '/api/meta', {}, (req, res) => {
  const nonAdmin = db.users.filter(u => u.role !== 'admin');
  const citySet = new Set(nonAdmin.map(u => u.city.toLowerCase()));
  sendJson(res, 200, {
    cities: CITIES, vibes: VIBES, emojis: EMOJIS, vibeById: Object.fromEntries(VIBES.map(v => [v.id, v])),
    grads: GRADS.map(g => ({ from: g[0], to: g[1] })),
    genders: GENDERS,
    stats: { users: nonAdmin.filter(u => !u.isBot).length, frens: nonAdmin.length, cities: citySet.size }
  });
});

addRoute('POST', '/api/signup', {}, async (req, res, params, body) => {
  const name = titleCaseName(String(body.name || ''));
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const city = normalizeCity(body.city);
  const age = parseInt(body.age, 10);
  const gender = GENDERS.includes(body.gender) ? body.gender : 'prefer not to say';
  const bio = String(body.bio || '').trim().slice(0, 220);
  let vibes = Array.isArray(body.vibes) ? body.vibes.filter(v => VIBES.some(x => x.id === v)) : [];
  vibes = [...new Set(vibes)].slice(0, 5);

  if (name.length < 2 || name.length > 24) return bad(res, 'name should be 2-24 chars');
  if (!USERNAME_RE.test(username)) return bad(res, 'username: 3-16 chars, letters/numbers/_ only');
  if (!EMAIL_RE.test(email)) return bad(res, 'thats not a real email bestie 📧 check it and try again');
  if (validPhoto(body.photo) === false && body.photo !== undefined && body.photo !== null) return bad(res, 'pic too big or not an image 💀');
  if (password.length < 6) return bad(res, 'password needs at least 6 chars');
  if (!Number.isInteger(age) || age < 13 || age > 19) return bad(res, 'frfr is for teens 13-19 only');
  if (!city) return bad(res, 'enter ur city so we can find ur frens');
  const emailKey = normalizeEmailKey(email);
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return bad(res, 'username already taken 😬');
  if (db.users.some(u => u.emailKey === emailKey || u.email.toLowerCase() === email)) return bad(res, 'email already has an account — try logging in');

  const { salt, hash } = hashPassword(password);
  const avatar = {
    emoji: EMOJIS.includes(body.avatarEmoji) ? body.avatarEmoji : pick(EMOJIS),
    grad: Number.isInteger(body.avatarGrad) && body.avatarGrad >= 0 && body.avatarGrad < GRADS.length ? body.avatarGrad : randInt(0, GRADS.length - 1)
  };
  const user = {
    id: uid('u'), role: 'user', name, username, email,
    passSalt: salt, passHash: hash,
    age, city, gender, bio, vibes, avatar,
    isBot: false, createdAt: Date.now()
  };
  if (body.photo) { user.photo = body.photo; user.photos = [body.photo]; }
  user.emailVerified = false;
  user.emailKey = emailKey;
  user.xp = 0; user.level = 1;
  bumpStreak(user);
  dailyQuest(user);
  db.users.push(user);
  saveDb();
  const v = await issueVerification(user);
  sendJson(res, 200, {
    needVerification: true, verifyToken: v.pending,
    email: user.email, name: user.name, mailMode: v.mode,
    devCode: v.mode === 'demo' ? v.code : undefined
  });
});

addRoute('POST', '/api/login', {}, async (req, res, params, body) => {
  const user = findUserByUsernameOrEmail(body.identifier);
  if (!user || !verifyPassword(body.password, user.passSalt, user.passHash)) {
    return bad(res, 'wrong username or password 🙅', 401);
  }
  bumpStreak(user);
  if (!user.emailVerified && user.role !== 'admin') {
    const since = (db.verifications || {})[user.id] ? (db.verifications[user.id].lastSent || 0) : 0;
    if (Date.now() - since > VERIF_COOLDOWN || !db.verifications[user.id]) {
      const v = await issueVerification(user);
      return sendJson(res, 200, {
        needVerification: true, verifyToken: v.pending,
        email: user.email, name: user.name, mailMode: v.mode,
        devCode: v.mode === 'demo' ? v.code : undefined
      });
    }
    const pending = crypto.randomBytes(24).toString('hex');
    pendingVerifs.set(pending, { userId: user.id, at: Date.now() });
    return sendJson(res, 200, {
      needVerification: true, verifyToken: pending,
      email: user.email, name: user.name, mailMode: 'demo', cooldown: true
    });
  }
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = user.id;
  saveDb();
  sendJson(res, 200, { token, user: publicUser(user, { withEmail: true }) });
});

addRoute('POST', '/api/logout', { auth: true }, (req, res, params, body, user, extra) => {
  delete db.sessions[extra.token];
  saveDb();
  sendJson(res, 200, { ok: true });
});

addRoute('POST', '/api/quest/claim', { auth: true }, (req, res, params, body, user) => {
  dailyQuest(user);
  const q = user.quest;
  if (!q.done) return bad(res, 'quest not finished yet 👀');
  if (q.claimed) return bad(res, 'already claimed this one 🫡');
  q.claimed = true;
  const up = addXp(user, q.xp || 40, 'quest complete');
  saveDb();
  sendJson(res, 200, { ok: true, xpGain: q.xp || 40, level: user.level || 1, xpTotal: user.xp || 0, xpNext: xpForLevel((user.level || 1) + 1), leveledUp: up ? up.leveledUp : null });
});

addRoute('POST', '/api/verify', {}, (req, res, params, body) => {
  const p = pendingVerifs.get(body.token);
  if (!p) return bad(res, 'verification session expired — log in again 🙅', 404);
  const user = findUser(p.userId);
  if (!user) return bad(res, 'account gone 💀', 404);
  const r = checkVerification(user, body.code);
  if (!r.ok) return bad(res, r.msg);
  pendingVerifs.delete(body.token);
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = user.id;
  saveDb();
  sendJson(res, 200, { token, user: publicUser(user, { withEmail: true }) });
});

addRoute('POST', '/api/verify/resend', {}, async (req, res, params, body) => {
  const p = pendingVerifs.get(body.token);
  if (!p) return bad(res, 'verification session expired — log in again 🙅', 404);
  const user = findUser(p.userId);
  if (!user) return bad(res, 'account gone 💀', 404);
  const v = (db.verifications || {})[user.id];
  if (v && Date.now() - (v.lastSent || 0) < VERIF_COOLDOWN) {
    return bad(res, 'slow down — resend unlocked in ' + Math.ceil((VERIF_COOLDOWN - (Date.now() - v.lastSent)) / 1000) + 's ⏳');
  }
  const nv = await issueVerification(user);
  sendJson(res, 200, { ok: true, mailMode: nv.mode, devCode: nv.mode === 'demo' ? nv.code : undefined });
});

/* --------------------------------------------------------------- api: user */
/* ---- engagement: streaks, xp, daily quest ---- */
function dayKey(t) { return new Date(t || Date.now()).toISOString().slice(0, 10); }
function bumpStreak(user) {
  const today = dayKey();
  const yest = dayKey(Date.now() - 86400000);
  user.streak = user.streak || { count: 0, last: null, best: 0 };
  if (user.streak.last === today) return; // already today
  user.streak.count = user.streak.last === yest ? user.streak.count + 1 : 1;
  user.streak.last = today;
  user.streak.best = Math.max(user.streak.best || 0, user.streak.count);
}
function addXp(user, amount, reason) {
  user.xp = (user.xp || 0) + amount;
  const lvl = lvlOf(user.xp);
  if (lvl > (user.level || 1)) {
    user.level = lvl;
    return { leveledUp: lvl, reason };
  }
  return null;
}
function lvlOf(xp) { return Math.max(1, Math.floor(Math.sqrt((xp || 0) / 50)) + 1); }
function xpForLevel(l) { return 50 * (l - 1) * (l - 1); }

addRoute('GET', '/api/me', { auth: true }, (req, res, params, body, user) => {
  const likes = db.requests.filter(r => r.to === user.id && (r.status === 'pending' || r.status === 'accepted')).length;
  const reqCount = db.requests.filter(r => r.to === user.id && r.status === 'pending').length;
  const myMatches = db.matches.filter(m => m.a === user.id || m.b === user.id).length;
  // streak + quest state (no side effects on GET besides keeping today's streak warm)
  if (user.streak && user.streak.last === dayKey()) { /* warm */ }
  const quest = dailyQuest(user);
  sendJson(res, 200, {
    user: publicUser(user, { withEmail: true }), likesReceived: likes, matches: myMatches, reqCount,
    streak: user.streak || { count: 0, last: null, best: 0 },
    xp: user.xp || 0, level: user.level || 1, xpNext: xpForLevel((user.level || 1) + 1),
    quest: quest.state
  });
});

function dailyQuest(user) {
  const q = user.quest || {};
  if (q.day !== dayKey()) {
    // fresh day: regenerate quest
    const quests = [
      { id: 'like3', label: 'double-tap 3 profiles', target: 3, xp: 40, kind: 'likes' },
      { id: 'chat1', label: 'send 1 message to a fren', target: 1, xp: 60, kind: 'msgs' },
      { id: 'pic1', label: 'add a profile pic', target: 1, xp: 50, kind: 'pics' }
    ];
    user.quest = { day: dayKey(), ...quests[Math.floor(Math.random() * quests.length)], progress: 0, done: false, claimed: false };
  }
  return { state: user.quest };
}
function questProgress(user, kind, n = 1) {
  dailyQuest(user);
  const q = user.quest;
  if (q.kind === kind && !q.done) {
    q.progress = Math.min(q.target, (q.progress || 0) + n);
    if (q.progress >= q.target) { q.done = true; }
    saveDb();
  }
}

addRoute('PUT', '/api/me', { auth: true }, (req, res, params, body, user) => {
  if (body.name !== undefined) {
    const n = titleCaseName(String(body.name || ''));
    if (n.length < 2 || n.length > 24) return bad(res, 'name should be 2-24 chars');
    user.name = n;
  }
  if (body.bio !== undefined) user.bio = String(body.bio || '').trim().slice(0, 220);
  if (body.gender !== undefined && GENDERS.includes(body.gender)) user.gender = body.gender;
  if (body.vibes !== undefined) {
    let v = Array.isArray(body.vibes) ? body.vibes.filter(x => VIBES.some(t => t.id === x)) : [];
    user.vibes = [...new Set(v)].slice(0, 5);
  }
  if (body.photo !== undefined) {
    if (body.photo === null) { delete user.photo; user.photos = []; }
    else if (validPhoto(body.photo)) { user.photo = body.photo; if (!(user.photos || []).includes(body.photo)) { user.photos = [body.photo, ...(user.photos || [])].slice(0, 3); } }
    else return bad(res, 'pic too big or not an image 💀 (max ~300KB)');
  }
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) return bad(res, 'bad photos list');
    const arr = body.photos.filter(validPhoto).slice(0, 3);
    if (arr.length !== body.photos.length) return bad(res, 'pic too big or not an image 💀 (max ~300KB)');
    user.photos = arr;
    if (arr[0]) user.photo = arr[0]; else delete user.photo;
  }
  if (body.avatar !== undefined && body.avatar && typeof body.avatar === 'object') {
    const emoji = EMOJIS.includes(body.avatar.emoji) ? body.avatar.emoji : user.avatar.emoji;
    const grad = Number.isInteger(body.avatar.grad) && body.avatar.grad >= 0 && body.avatar.grad < GRADS.length ? body.avatar.grad : user.avatar.grad;
    user.avatar = { emoji, grad };
  }
  if (body.city !== undefined) {
    const c = normalizeCity(body.city);
    if (!c) return bad(res, 'enter a valid city');
    if (c !== user.city) user.city = c;
  }
  if (body.age !== undefined) {
    const a = parseInt(body.age, 10);
    if (!Number.isInteger(a) || a < 13 || a > 19) return bad(res, 'frfr is for teens 13-19 only');
    user.age = a;
  }
  saveDb();
  sendJson(res, 200, { user: publicUser(user, { withEmail: true }) });
});

/* --------------------------------------------------------------- api: deck */
addRoute('GET', '/api/trending', { auth: true }, (req, res, params, body, user) => {
  const cityLc = user.city.toLowerCase();
  const countVibes = (list) => {
    const m = new Map();
    for (const id of list) m.set(id, (m.get(id) || 0) + 1);
    return m;
  };
  const mine = countVibes(db.users.filter(u => u.role !== 'admin' && u.city.toLowerCase() === cityLc && u.id !== user.id).flatMap(u => u.vibes || []));
  const all = countVibes(db.users.filter(u => u.role !== 'admin' && u.id !== user.id).flatMap(u => u.vibes || []));
  const shape = (map) => [...map.entries()]
    .map(([id, n]) => ({ id, n, vibe: VIBES.find(v => v.id === id) }))
    .filter(x => x.vibe)
    .sort((a, b) => b.n - a.n).slice(0, 8);
  sendJson(res, 200, { city: shape(mine), india: shape(all) });
});

addRoute('GET', '/api/explore', { auth: true }, (req, res, params, body, user) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const vibe = q.get('vibe');
  const search = (q.get('q') || '').trim().toLowerCase();
  const scope = q.get('scope') || 'city'; // city | india
  const frenIds = new Set(db.matches.filter(m => m.a === user.id || m.b === user.id).map(m => (m.a === user.id ? m.b : m.a)));

  let pool = db.users.filter(u => u.id !== user.id && u.role !== 'admin' && !frenIds.has(u.id));
  if (scope === 'city') pool = pool.filter(u => u.city.toLowerCase() === user.city.toLowerCase());
  if (vibe && VIBES.some(v => v.id === vibe)) pool = pool.filter(u => (u.vibes || []).includes(vibe));
  if (search) pool = pool.filter(u =>
    u.name.toLowerCase().includes(search) ||
    u.username.toLowerCase().includes(search) ||
    u.city.toLowerCase().includes(search) ||
    (u.bio || '').toLowerCase().includes(search)
  );
  // sort: recently online first, then newest members
  pool.sort((a, b) => (b.lastSeen || b.createdAt || 0) - (a.lastSeen || a.createdAt || 0));
  const onlineCount = pool.filter(u => (u.lastSeen || 0) > Date.now() - 120000).length;
  sendJson(res, 200, {
    people: pool.slice(0, 40).map(u => publicUser(u)),
    onlineCount,
    total: pool.length
  });
});

addRoute('GET', '/api/feed', { auth: true }, (req, res, params, body, user) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const page = Math.max(0, parseInt(q.get('page') || '0', 10) || 0);
  const limit = Math.min(20, Math.max(1, parseInt(q.get('limit') || '8', 10) || 8));
  const scope = q.get('scope') === 'india' ? 'india' : 'city';
  const cityFilter = (q.get('city') || '').trim().toLowerCase();
  const vibeFilters = (q.get('vibes') || '').split(',').map(s => s.trim()).filter(s => VIBES.some(v => v.id === s)).slice(0, 5);
  const myCity = user.city.toLowerCase();
  const frenIds = new Set(db.matches.filter(m => m.a === user.id || m.b === user.id).map(m => (m.a === user.id ? m.b : m.a)));
  const rejectedByMe = new Set(db.requests.filter(r => r.from === user.id && r.status === 'rejected').map(r => r.to));
  const pendingFromMe = new Set(db.requests.filter(r => r.from === user.id && r.status === 'pending').map(r => r.to));
  const likedMePending = new Set(db.requests.filter(r => r.to === user.id && r.status === 'pending').map(r => r.from));

  let pool = db.users.filter(u =>
    u.id !== user.id &&
    u.role !== 'admin' &&
    !frenIds.has(u.id) &&
    !rejectedByMe.has(u.id)
  );
  if (scope === 'city') {
    pool = pool.filter(u => u.city.toLowerCase() === myCity);
  } else if (cityFilter) {
    pool = pool.filter(u => u.city.toLowerCase() === cityFilter);
  }
  if (vibeFilters.length) {
    pool = pool.filter(u => vibeFilters.every(v => (u.vibes || []).includes(v)));
  }
  pool = pool;
  // people who requested u first show up first; rest in a stable (per-user) shuffled order
  pool.sort((a, b) => {
    const la = likedMePending.has(b.id) ? 1 : 0, lb = likedMePending.has(a.id) ? 1 : 0;
    if (la !== lb) return la - lb;
    const ha = crypto.createHash('md5').update(user.id + a.id).digest('hex');
    const hb = crypto.createHash('md5').update(user.id + b.id).digest('hex');
    return ha < hb ? -1 : 1;
  });
  const total = pool.length;
  const items = pool.slice(page * limit, page * limit + limit).map(u => ({
    ...publicUser(u),
    _likesYou: likedMePending.has(u.id),
    _reqStatus: pendingFromMe.has(u.id) ? 'pending' : 'none'
  }));
  // city facets for the filter dropdown (based on the full non-fren pool, ignoring city/vibe filters)
  const facetBase = db.users.filter(u =>
    u.id !== user.id && u.role !== 'admin' && !frenIds.has(u.id) && !rejectedByMe.has(u.id)
  );
  const cityFacets = new Map();
  for (const u of facetBase) cityFacets.set(u.city, (cityFacets.get(u.city) || 0) + 1);
  const topCities = [...cityFacets.entries()].map(([c, n]) => ({ city: c, count: n }))
    .sort((a, b) => b.count - a.count).slice(0, 30);
  sendJson(res, 200, {
    items, total, page, done: page * limit + items.length >= total,
    city: user.city, scope, cityFilter, vibes: vibeFilters,
    cities: topCities
  });
});

addRoute('POST', '/api/request', { auth: true }, (req, res, params, body, user) => {
  const target = findUser(body.targetId);
  if (!target || target.id === user.id || target.role === 'admin') return bad(res, 'invalid target');
  if (existingMatch(user.id, target.id)) return bad(res, 'yall are already frens 🤝');

  const mine = db.requests.find(r => r.from === user.id && r.to === target.id);
  if (mine && mine.status === 'pending') return sendJson(res, 200, { status: 'already' });

  // they asked u first + u like back = instant frens ✨
  const theirs = db.requests.find(r => r.from === target.id && r.to === user.id && r.status === 'pending');
  if (theirs) {
    theirs.status = 'accepted'; theirs.decidedAt = Date.now();
    if (mine && mine.status === 'pending') { mine.status = 'accepted'; mine.decidedAt = Date.now(); }
    let match = existingMatch(user.id, target.id);
    if (!match) {
      match = { id: uid('m'), pair: pairKey(user.id, target.id), a: user.id, b: target.id, at: Date.now() };
      db.matches.push(match);
    }
    saveDb();
    return sendJson(res, 200, { status: 'mutual', match: { id: match.id, user: publicUser(target) } });
  }

  if (mine && mine.status === 'rejected') { mine.status = 'pending'; mine.at = Date.now(); }
  else if (!mine) db.requests.push({ id: uid('r'), from: user.id, to: target.id, status: 'pending', at: Date.now() });

  // demo frens sometimes accept instantly so u feel the dopamine ✨
  if (target.isBot && Math.random() < 0.65) {
    const r = db.requests.find(x => x.from === user.id && x.to === target.id);
    r.status = 'accepted'; r.decidedAt = Date.now();
    const match = { id: uid('m'), pair: pairKey(user.id, target.id), a: user.id, b: target.id, at: Date.now() };
    db.matches.push(match);
    saveDb();
    return sendJson(res, 200, { status: 'mutual', match: { id: match.id, user: publicUser(target) } });
  }
  questProgress(user, 'likes');
  saveDb();
  sendJson(res, 200, { status: 'sent', level: user.level || 1 });
});

addRoute('GET', '/api/nearby', { auth: true }, (req, res, params, body, user) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const radius = Math.min(500, Math.max(10, parseInt(q.get('radius') || '100', 10) || 100));
  const frenIds = new Set(db.matches.filter(m => m.a === user.id || m.b === user.id).map(m => (m.a === user.id ? m.b : m.a)));
  const cityLc = user.city.toLowerCase();
  const sameCity = [];
  const nearCities = new Map();
  for (const u of db.users) {
    if (u.id === user.id || u.role === 'admin' || frenIds.has(u.id)) continue;
    if (u.city.toLowerCase() === cityLc) { sameCity.push(u); continue; }
    // rough "near" = shares first 3 letters of city name or within same state cluster (demo heuristic)
    const key = u.city.toLowerCase();
    nearCities.set(key, (nearCities.get(key) || 0) + 1);
  }
  const nearList = [...nearCities.entries()].map(([c, n]) => ({ city: c, users: n }))
    .sort((a, b) => b.users - a.users).slice(0, 6);
  const onlineNow = sameCity.filter(u => (u.lastSeen || 0) > Date.now() - 120000);
  sendJson(res, 200, {
    onlineNow: onlineNow.slice(0, 20).map(u => publicUser(u)),
    onlineCount: onlineNow.length,
    sameCityCount: sameCity.length,
    nearCities: nearList,
    radius
  });
});

/* ---- vibe lobbies (Yubo-inspired quick-match) ---- */
const LOBBY_TTL = 60 * 1000; // lobby heartbeat expires after 60s
function touchLobby(user, intent) {
  db.lobbies = (db.lobbies || []).filter(l => l.userId !== user.id && Date.now() - l.at < LOBBY_TTL);
  const mine = db.lobbies.find(l => l.userId === user.id);
  if (mine) { mine.at = Date.now(); mine.intent = intent || mine.intent; }
  else db.lobbies.push({ userId: user.id, at: Date.now(), intent: intent || 'any' });
  saveDb();
}
function findLobbyMatch(user, intent) {
  const now = Date.now();
  db.lobbies = (db.lobbies || []).filter(l => l.userId !== user.id && now - l.at < LOBBY_TTL);
  const candidates = db.lobbies.filter(l => {
    if (l.userId === user.id) return false;
    const u = findUser(l.userId);
    if (!u || u.role === 'admin') return false;
    if (!intentCompat(intent, l.intent)) return false;
    return true;
  });
  // prefer same city, then shared vibe, then anyone
  candidates.sort((a, b) => {
    const ua = findUser(a.userId), ub = findUser(b.userId);
    const ca = ua.city.toLowerCase() === user.city.toLowerCase() ? 0 : 1;
    const cb = ub.city.toLowerCase() === user.city.toLowerCase() ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const va = (ua.vibes || []).some(v => (user.vibes || []).includes(v)) ? 0 : 1;
    const vb = (ub.vibes || []).some(v => (user.vibes || []).includes(v)) ? 0 : 1;
    return va - vb;
  });
  return candidates[0] || null;
}
function intentCompat(a, b) {
  const A = a || 'any', B = b || 'any';
  if (A === 'any' || B === 'any') return true;
  return A === B;
}

addRoute('POST', '/api/lobby/join', { auth: true }, async (req, res, params, body, user) => {
  const intent = ['any', 'girls', 'boys'].includes(body.intent) ? body.intent : 'any';
  touchLobby(user, intent);
  // bot squash: 55% chance a demo fren "joins" after 1.5-3s simulated wait
  const frenIds = new Set(db.matches.filter(m => m.a === user.id || m.b === user.id).map(m => (m.a === user.id ? m.b : m.a)));
  const pool = db.users.filter(u => u.isBot && u.role !== 'admin' && !frenIds.has(u.id) &&
    (intent === 'any' || (intent === 'girls' && u.gender === 'girl') || (intent === 'boys' && u.gender === 'boy')));
  if (pool.length && Math.random() < 0.8) {
    // prefer same city / shared vibes
    pool.sort((a, b) => {
      const ca = a.city.toLowerCase() === user.city.toLowerCase() ? 0 : 1;
      const cb = b.city.toLowerCase() === user.city.toLowerCase() ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const va = (a.vibes || []).some(v => (user.vibes || []).includes(v)) ? 0 : 1;
      const vb = (b.vibes || []).some(v => (user.vibes || []).includes(v)) ? 0 : 1;
      return va - vb;
    });
    const partner = pool[0];
    // real-looking wait
    await new Promise(r => setTimeout(r, 1500 + Math.floor(Math.random() * 1500)));
    if (!db.matches.some(m => (m.a === user.id && m.b === partner.id) || (m.b === user.id && m.a === partner.id))) {
      db.matches.push({ id: uid('m'), pair: pairKey(user.id, partner.id), a: user.id, b: partner.id, at: Date.now() });
      saveDb();
    }
    db.lobbies = (db.lobbies || []).filter(l => l.userId !== user.id);
    bumpStreak(user);
    const up = addXp(user, 20, 'quick match');
    const match = db.matches.find(m => (m.a === user.id && m.b === partner.id) || (m.b === user.id && m.a === partner.id));
    saveDb();
    return sendJson(res, 200, {
      status: 'matched', partner: publicUser(partner),
      match: { id: match ? match.id : null, user: publicUser(partner) },
      xpGain: 20, leveledUp: up ? up.leveledUp : null, xpTotal: user.xp || 0, xpNext: xpForLevel((user.level || 1) + 1)
    });
  }
  // check real humans waiting
  const match = findLobbyMatch(user, intent);
  if (match) {
    const partner = findUser(match.userId);
    db.lobbies = (db.lobbies || []).filter(l => l.userId !== user.id && l.userId !== match.userId);
    if (!db.matches.some(m => (m.a === user.id && m.b === partner.id) || (m.b === user.id && m.a === partner.id))) {
      db.matches.push({ id: uid('m'), pair: pairKey(user.id, partner.id), a: user.id, b: partner.id, at: Date.now() });
      saveDb();
    }
    const match = db.matches.find(m => (m.a === user.id && m.b === partner.id) || (m.b === user.id && m.a === partner.id));
    return sendJson(res, 200, { status: 'matched', partner: publicUser(partner), match: { id: match ? match.id : null, user: publicUser(partner) } });
  }
  const waitingSameIntent = (db.lobbies || []).filter(l => intentCompat(l.intent, intent)).length;
  sendJson(res, 200, { status: 'waiting', waiting: waitingSameIntent + 1 });
});

addRoute('POST', '/api/lobby/leave', { auth: true }, (req, res, params, body, user) => {
  db.lobbies = (db.lobbies || []).filter(l => l.userId !== user.id);
  saveDb();
  sendJson(res, 200, { ok: true });
});

addRoute('GET', '/api/lobby/status', { auth: true }, (req, res, params, body, user) => {
  const now = Date.now();
  db.lobbies = (db.lobbies || []).filter(l => now - l.at < LOBBY_TTL);
  const online = db.users.filter(u => u.role !== 'admin' && (u.lastSeen || 0) > now - 120000).length;
  sendJson(res, 200, { online, waiting: db.lobbies.length, inLobby: (db.lobbies || []).some(l => l.userId === user.id) });
});

addRoute('GET', '/api/vibe-check', { auth: true }, (req, res, params, body, user) => {
  const frenIds = new Set(db.matches.filter(m => m.a === user.id || m.b === user.id).map(m => (m.a === user.id ? m.b : m.a)));
  const pool = db.users.filter(u => u.id !== user.id && u.role !== 'admin' && !frenIds.has(u.id));
  if (!pool.length) return sendJson(res, 200, { person: null });
  // pick by shared vibes first, else random
  const shared = pool.filter(u => (u.vibes || []).some(v => (user.vibes || []).includes(v)));
  const person = publicUser(shared.length ? shared[Math.floor(Math.random() * shared.length)] : pool[Math.floor(Math.random() * pool.length)]);
  const sharedVibes = (person.vibes || []).filter(v => (user.vibes || []).includes(v));
  sendJson(res, 200, { person, sharedVibes });
});

addRoute('GET', '/api/requests', { auth: true }, (req, res, params, body, user) => {
  const incoming = db.requests
    .filter(r => r.to === user.id && r.status === 'pending')
    .map(r => ({ id: r.id, at: r.at, user: publicUser(findUser(r.from)) }))
    .filter(x => x.user).sort((a, b) => b.at - a.at);
  const sent = db.requests
    .filter(r => r.from === user.id && r.status === 'pending')
    .map(r => ({ id: r.id, at: r.at, user: publicUser(findUser(r.to)) }))
    .filter(x => x.user).sort((a, b) => b.at - a.at);
  sendJson(res, 200, { incoming, sent });
});

addRoute('POST', '/api/requests/:id/accept', { auth: true }, (req, res, params, body, user) => {
  const r = db.requests.find(x => x.id === params.id);
  if (!r || r.to !== user.id) return bad(res, 'request not found', 404);
  if (r.status !== 'pending') return bad(res, 'already handled this one');
  r.status = 'accepted'; r.decidedAt = Date.now();
  let match = existingMatch(r.from, r.to);
  if (!match) {
    match = { id: uid('m'), pair: pairKey(r.from, r.to), a: r.from, b: r.to, at: Date.now() };
    db.matches.push(match);
  }
  bumpStreak(user); bumpStreak(findUser(r.from) || user);
  addXp(user, 15, 'made a fren');
  addXp(findUser(r.from) || user, 15, 'made a fren');
  saveDb();
  sendJson(res, 200, { ok: true, match: { id: match.id, user: publicUser(findUser(r.from)) } });
});

addRoute('POST', '/api/requests/:id/reject', { auth: true }, (req, res, params, body, user) => {
  const r = db.requests.find(x => x.id === params.id);
  if (!r || r.to !== user.id) return bad(res, 'request not found', 404);
  if (r.status !== 'pending') return bad(res, 'already handled this one');
  r.status = 'rejected'; r.decidedAt = Date.now();
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ------------------------------------------------------------ api: matches */
addRoute('GET', '/api/matches', { auth: true }, (req, res, params, body, user) => {
  const mine = db.matches
    .filter(m => m.a === user.id || m.b === user.id)
    .map(m => {
      const otherId = m.a === user.id ? m.b : m.a;
      const other = findUser(otherId);
      if (!other) return null;
      const msgs = db.messages.filter(x => x.matchId === m.id);
      const last = msgs[msgs.length - 1] || null;
      return {
        id: m.id, at: m.at, user: publicUser(other),
        lastMessage: last ? { text: last.text, at: last.at, fromMe: last.from === user.id } : null,
        msgCount: msgs.length
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.lastMessage ? b.lastMessage.at : b.at) - (a.lastMessage ? a.lastMessage.at : a.at));
  sendJson(res, 200, { matches: mine });
});

function getMatchIfParticipant(req, res, id, user) {
  const match = db.matches.find(m => m.id === id);
  if (!match || (match.a !== user.id && match.b !== user.id)) {
    bad(res, 'match not found', 404);
    return null;
  }
  return match;
}

addRoute('GET', '/api/matches/:id/messages', { auth: true }, (req, res, params, body, user) => {
  const match = getMatchIfParticipant(req, res, params.id, user);
  if (!match) return;
  const otherId = match.a === user.id ? match.b : match.a;
  const other = findUser(otherId);
  const msgs = db.messages
    .filter(m => m.matchId === match.id)
    .slice(-200)
    .map(m => ({ id: m.id, text: m.text, at: m.at, fromMe: m.from === user.id }));
  sendJson(res, 200, { messages: msgs, user: publicUser(other) });
});

addRoute('POST', '/api/matches/:id/messages', { auth: true }, (req, res, params, body, user) => {
  const match = getMatchIfParticipant(req, res, params.id, user);
  if (!match) return;
  const text = String(body.text || '').trim().slice(0, 1000);
  if (!text) return bad(res, 'say something 🗣️');
  const msg = { id: uid('msg'), matchId: match.id, from: user.id, text, at: Date.now() };
  db.messages.push(msg);
  questProgress(user, 'msgs');
  const up = addXp(user, 5, 'yapped');
  saveDb();
  sendJson(res, 200, { message: { id: msg.id, text: msg.text, at: msg.at, fromMe: true }, xpGain: 5, leveledUp: up ? up.leveledUp : null, xpTotal: user.xp || 0, xpNext: xpForLevel((user.level || 1) + 1) });
});

/* ------------------------------------------------------------- api: admin */
function requireAdmin(req, res, user) {
  if (!user || user.role !== 'admin') { bad(res, 'admin only 🛡️', 403); return false; }
  return true;
}

addRoute('GET', '/api/admin/stats', { auth: true }, (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  const real = db.users.filter(u => !u.isBot && u.role !== 'admin');
  const bots = db.users.filter(u => u.isBot);
  const admins = db.users.filter(u => u.role === 'admin');
  const reqStats = {
    sent: db.requests.filter(r => r.status === 'pending').length,
    accepted: db.requests.filter(r => r.status === 'accepted').length,
    rejected: db.requests.filter(r => r.status === 'rejected').length
  };
  const cityMap = new Map();
  for (const u of db.users.filter(u => u.role !== 'admin')) {
    const k = u.city;
    if (!cityMap.has(k)) cityMap.set(k, { city: k, users: 0, matches: 0 });
    cityMap.get(k).users++;
  }
  for (const m of db.matches) {
    const a = findUser(m.a), b = findUser(m.b);
    for (const p of [a, b]) {
      if (p && cityMap.has(p.city)) cityMap.get(p.city).matches++;
    }
  }
  const top = [...cityMap.values()].sort((x, y) => y.users - x.users).slice(0, 12);
  const dayAgo = Date.now() - 86400000;
  const weekAgo = Date.now() - 7 * 86400000;
  sendJson(res, 200, {
    users: { total: db.users.length, real: real.length, demo: bots.length, admins: admins.length },
    requests: reqStats,
    matches: db.matches.length,
    messages: db.messages.length,
    signupsToday: real.filter(u => u.createdAt > dayAgo).length,
    signupsWeek: real.filter(u => u.createdAt > weekAgo).length,
    cities: { count: cityMap.size, top },
    recent: db.users
      .filter(u => u.role !== 'admin')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map(u => ({ name: u.name, username: u.username, city: u.city, isBot: u.isBot, at: u.createdAt }))
  });
});

addRoute('GET', '/api/admin/users', { auth: true }, (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  const rows = db.users.filter(u => u.role !== 'admin').map(u => {
    const reqs = db.requests.filter(r => r.from === u.id).length;
    const matches = db.matches.filter(m => m.a === u.id || m.b === u.id).length;
    const msgs = db.messages.filter(m => m.from === u.id).length;
    return { ...publicUser(u, { withEmail: true, noPhoto: true }), reqs, matches, msgs };
  }).sort((a, b) => b.createdAt - a.createdAt);
  sendJson(res, 200, { users: rows });
});

addRoute('DELETE', '/api/admin/users/:id', { auth: true }, (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  const target = findUser(params.id);
  if (!target) return bad(res, 'user not found', 404);
  if (target.role === 'admin') return bad(res, 'cant delete an admin lol');
  db.users = db.users.filter(u => u.id !== target.id);
  db.swipes = db.swipes.filter(s => s.from !== target.id && s.to !== target.id);
  const deadMatches = db.matches.filter(m => m.a === target.id || m.b === target.id).map(m => m.id);
  db.matches = db.matches.filter(m => m.a !== target.id && m.b !== target.id);
  db.messages = db.messages.filter(m => !deadMatches.includes(m.matchId));
  for (const [tok, uidv] of Object.entries(db.sessions)) {
    if (uidv === target.id) delete db.sessions[tok];
  }
  saveDb();
  sendJson(res, 200, { ok: true });
});

addRoute('GET', '/api/admin/mail', { auth: true }, (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  const cfg = getMailConfig();
  sendJson(res, 200, { mode: cfg.mode, user: cfg.mode === 'gmail' ? cfg.user : null });
});

addRoute('POST', '/api/admin/mail', { auth: true }, (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  const g = String(body.gmail || '').trim().toLowerCase();
  const p = String(body.appPass || '').replace(/\s+/g, '');
  if (!GMAIL_RE.test(g)) return bad(res, 'thats not a gmail address 📧');
  if (p.length < 16 || p.length > 40) return bad(res, 'app password should be the 16-character one from Google');
  db.settings = db.settings || {};
  db.settings.mail = { user: g, appPass: p };
  saveDb();
  sendJson(res, 200, { ok: true, mode: 'gmail', user: g });
});

addRoute('POST', '/api/admin/mail/clear', { auth: true }, (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  db.settings = db.settings || {};
  delete db.settings.mail;
  saveDb();
  sendJson(res, 200, { ok: true, mode: 'demo' });
});

addRoute('POST', '/api/admin/mail/test', { auth: true }, async (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  const cfg = getMailConfig();
  if (cfg.mode !== 'gmail') return bad(res, 'save ur gmail + app password first 📧');
  const to = GMAIL_RE.test(String(body.to || '').trim()) ? String(body.to).trim().toLowerCase() : cfg.user;
  try {
    await smtpSendMail({ host: cfg.host, port: cfg.port, user: cfg.user, pass: cfg.pass, from: cfg.user, to, subject: 'frfr test — email delivery works 🎉', html: mailHtml('admin', '1234').replace('4242', '1234') });
    sendJson(res, 200, { ok: true, to });
  } catch (e) {
    sendJson(res, 200, { ok: false, error: e.message });
  }
});

addRoute('PUT', '/api/admin/users/:id', { auth: true }, (req, res, params, body, user) => {
  if (!requireAdmin(req, res, user)) return;
  const t = findUser(params.id);
  if (!t) return bad(res, 'user not found', 404);
  if (t.role === 'admin' && (body.username || body.email || body.password !== undefined)) {
    return bad(res, 'cant rename/reemail/repass the admin account');
  }
  if (body.name !== undefined) {
    const n = titleCaseName(String(body.name || ''));
    if (n.length < 2 || n.length > 24) return bad(res, 'name should be 2-24 chars');
    t.name = n;
  }
  if (body.username !== undefined) {
    const un = String(body.username || '').trim();
    if (!USERNAME_RE.test(un)) return bad(res, 'username: 3-16 chars, letters/numbers/_ only');
    if (db.users.some(u => u.id !== t.id && u.username.toLowerCase() === un.toLowerCase())) return bad(res, 'username already taken 😬');
    t.username = un;
  }
  if (body.email !== undefined) {
    const em = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return bad(res, 'thats not a real email bestie 📧');
    const ek = normalizeEmailKey(em);
    if (db.users.some(u => u.id !== t.id && (u.emailKey === ek || u.email.toLowerCase() === em))) return bad(res, 'email already on another account');
    t.email = em; t.emailKey = ek;
  }
  if (body.password) {
    if (String(body.password).length < 6) return bad(res, 'password needs at least 6 chars');
    const { salt, hash } = hashPassword(String(body.password));
    t.passSalt = salt; t.passHash = hash;
  }
  if (body.city !== undefined) {
    const c = normalizeCity(body.city);
    if (!c) return bad(res, 'enter a valid city');
    t.city = c;
  }
  if (body.age !== undefined) {
    const a = parseInt(body.age, 10);
    if (!Number.isInteger(a) || a < 13 || a > 19) return bad(res, 'age must be 13-19');
    t.age = a;
  }
  if (body.gender !== undefined && GENDERS.includes(body.gender)) t.gender = body.gender;
  if (body.bio !== undefined) t.bio = String(body.bio || '').trim().slice(0, 220);
  if (body.vibes !== undefined) {
    let v = Array.isArray(body.vibes) ? body.vibes.filter(x => VIBES.some(y => y.id === x)) : [];
    t.vibes = [...new Set(v)].slice(0, 5);
  }
  if (body.avatar !== undefined && body.avatar && typeof body.avatar === 'object') {
    const emoji = EMOJIS.includes(body.avatar.emoji) ? body.avatar.emoji : t.avatar.emoji;
    const grad = Number.isInteger(body.avatar.grad) && body.avatar.grad >= 0 && body.avatar.grad < GRADS.length ? body.avatar.grad : t.avatar.grad;
    t.avatar = { emoji, grad };
  }
  if (body.photo !== undefined) {
    if (body.photo === null) delete t.photo;
    else if (validPhoto(body.photo)) t.photo = body.photo;
    else return bad(res, 'pic too big or not an image 💀');
  }
  saveDb();
  sendJson(res, 200, { user: { ...publicUser(t, { withEmail: true, noPhoto: true }) } });
});

/* ------------------------------------------------------------------ static */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, pathname) {
  let p = decodeURIComponent(pathname);
  if (p === '/') p = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, p));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('nope'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback for non-file paths
      if (!path.extname(p)) {
        return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); return res.end('not found'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
          res.end(html);
        });
      }
      res.writeHead(404); return res.end('not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const cache = ['.ttf', '.woff2', '.mp3', '.png', '.jpg', '.svg'].includes(ext)
      ? 'public, max-age=86400' : 'no-store';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(data);
  });
}

/* ------------------------------------------------------------------ server */
function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve('');
    let data = '', size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 1e6) { req.destroy(); resolve(''); return; }
      data += c;
    });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = m[i + 1]; });
      const raw = await readBody(req);
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { return bad(res, 'bad json'); }
      let user = null;
      const authHeader = req.headers['authorization'] || '';
      const tokMatch = /^Bearer\s+(.+)$/i.exec(authHeader);
      const token = tokMatch ? tokMatch[1] : null;
      if (r.opts.auth) {
        user = authUser(req);
        if (!user) return bad(res, 'login first bestie 🙅', 401);
        bumpStreak(user);
  if (!user.emailVerified && user.role !== 'admin') {
          return sendJson(res, 403, { error: 'verify ur email first 📬 check ur inbox', code: 'UNVERIFIED' });
        }
        const now = Date.now();
        if (!user.lastSeen || now - user.lastSeen > 30000) { user.lastSeen = now; saveDb(); }
      }
      try {
        return await r.handler(req, res, params, body, user, { token });
      } catch (e) {
        console.error('[frfr] handler error', pathname, e);
        return bad(res, 'server hiccup 💀', 500);
      }
    }
    return bad(res, 'no such api route', 404);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, pathname);
});

loadDb();
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ✦✦✦  frfr build v2.8  ✦✦✦');
  console.log('  if u see this line, the NEWEST code is running (web badge: v2.8)');
  console.log(`[frfr] vibing on http://${HOST}:${PORT}  ✦  admin: admin / admin123`);
});
