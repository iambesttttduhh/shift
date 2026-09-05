# frfr. — make frens in ur city ✦

A Gen-Z style social web app for teens (13–19) across **India** to socialize and make new friends in their own city.

Create an account with your email, enter your city, and **frfr** matchmakes you with people from that exact city. **Double-tap** a profile to send a friend request (🔊 happy kitty + 💌 heart burst) — they accept or reject from their inbox. Mutual likes = instant frens → chat. No cap.

## ✨ Features

- **Email signup** (any provider — one account per mailbox, +tag/dot tricks blocked) + **login with username or email & password**
- **Social-app interface** — 5-tab bottom bar (frens · requests · 🔥 feed · explore · me) with the feed as a center button, top action bar with 🧭 explore
- **Explore 🧭** — vibe chips, search (name/@user/city/bio), 📍my-city or 🇮🇳 all-India scope, people grid with shared-vibe badges, tap for profile peek + request
- **Feed filters** — on the feed itself: 📍 my city / 🇮🇳 whole india / any specific city from the dropdown, plus ✨ interest matching (pick up to 5 — shows people who have ALL of them)
- **Engagement layer** — 🔥 daily streaks (flickering HUD flame), ⚡ XP + levels (square-root curve), floating +xp numbers on meaningful actions (matching, chatting, quests — not for likes), daily quests (double-tap 3 profiles / send a message / add a pic) with claimable rewards & level-up blast
- **LIVE ⚡ quick match** (Yubo-inspired) — big pink LIVE center tab: pick anyone/girls/boys, hit start, get matched 1-on-1 instantly (scanning animation → waiting room → MATCHED → chat). Real users in the lobby match each other; demo frens keep it never-empty
- **Vibe check 🎲** — random matchmaker card that picks people who share your vibes
- **City-based matchmaking** — the for u feed only shows people from the city you entered (common aliases work too: "Bangalore" → Bengaluru, "Gurgaon" → Gurugram, …)
- **For u ⚡ feed** (Reels-style scroll, TikTok-familiar) — scroll profiles, flip pic galleries (up to 3, first = cover), **double-tap = friend request** with heart-burst + happy-cat dopamine; scroll past to skip
- **Friend requests inbox** 💌 — accept ✓ / reject ✕ from the nav (badge count); liking back = instant frens; demo frens sometimes accept instantly
- **Cat meme sound effects** — right swipe plays a happy kitty 🐱 (purrs included), left swipe plays a sad kiddy cat (toggle 🔊 in the header)
- **Frens + real-time-ish chat** (polling)
- **"wants to be ur fren" flag** — people who requested you float to the top of the feed 😏
- **Profile editing** — city, bio, avatar (emoji + gradient), vibes (up to 5)
- **Admin panel** 🛡️ — live stats (users, cities, swipes, matches, messages), city leaderboard, full user table with search + delete
- **Seeded demo frens** in 40 Indian cities so the deck is never empty (demo frens sometimes like you back so you can feel the match magic)

## 🛡️ Admin account (pre-made)

| | |
|---|---|
| **username** | `admin` |
| **password** | `admin123` |
| **email** | `admin@frfr.app` |

Login with it and the **admin** tab appears in the bottom nav.

## 🚀 Run it

```bash
node server.js
# → http://localhost:3000
```

Zero npm dependencies. Node 18+ (built and tested on Node 22). Data is persisted to `data/db.json` (created & seeded on first run).

## 🧱 Tech

- **Backend:** plain Node.js `http` server — REST JSON API, scrypt-hashed passwords, bearer-token sessions, atomic JSON-file persistence (`data/db.json`)
- **Frontend:** vanilla HTML/CSS/JS single-page app — pointer-event card physics, glassmorphism + neon gradients, bundled OFL fonts (Unbounded, Space Grotesk)
- **Audio:** cat meme sounds in `public/audio/` — `happy.mp3` (happy kitty on right swipe) / `ohno.mp3` (kiddy cat on left swipe)

## 📁 Structure

```
server.js            # API + static server + seed data (admin + demo frens)
public/
  index.html         # single-page shell
  styles.css         # the gen-z core
  app.js             # all views: auth, deck, chat, profile, admin
  fonts/             # Unbounded + Space Grotesk (OFL licenses included)
  audio/             # happy.mp3 (right swipe) · ohno.mp3 (left swipe)
data/db.json         # runtime data (gitignored, auto-created)
```

## 📧 Real email delivery (Gmail)

Verification codes send through **your own Gmail** via app password — configured right from the **admin panel → email delivery 📧**:

1. Google Account → **Security** → turn on **2-step verification**
2. Search **"App passwords"** → create one (16 characters)
3. Paste your gmail + app password in the admin panel → **save & use gmail** → **send test email**

The app ships with a built-in zero-dependency SMTP client (STARTTLS + AUTH PLAIN). Without config it runs in **demo mode** (code shown on screen). If Gmail misbehaves it auto-falls back to demo so nobody gets stuck. `GMAIL_USER` + `GMAIL_APP_PASS` env vars work too. Resend (`RESEND_API_KEY`) also supported.

## 📮 API quick reference

| Method | Route | What |
|---|---|---|
| POST | `/api/signup` | create account |
| POST | `/api/login` | login (username **or** email) |
| GET | `/api/trending` | top vibes in ur city + india |
| GET | `/api/explore` | vibe filter + search people |
| GET | `/api/nearby` | who's online now + cities near u |
| GET | `/api/vibe-check` | random matchmaker pick |
| POST | `/api/lobby/join` | quick-match lobby (Yubo-style instant 1-on-1) |
| POST | `/api/quest/claim` | claim the finished daily quest (+xp) |
| GET | `/api/feed` | scrollable profiles — filters: `scope=city\|india`, `city=`, `vibes=a,b` |
| POST | `/api/request` | send a friend request (mutual = instant frens) |
| GET | `/api/requests` | your inbox (incoming + sent) |
| POST | `/api/requests/:id/accept` or `/reject` | decide a request |
| GET | `/api/matches` | your frens |
| GET/POST | `/api/matches/:id/messages` | chat |
| GET/POST | `/api/admin/mail` | configure gmail delivery (admin) |
| POST | `/api/admin/mail/test` | send a test email (admin) |
| GET | `/api/admin/stats` | admin dashboard data |
| DELETE | `/api/admin/users/:id` | remove a user (admin) |

> ⚠️ Built as a demo: for a real deployment serving minors you'd want proper moderation, reporting, privacy controls, and COPPA/GDPR-K style compliance. Be safe out there, besties.


## Host it FREE on Render ☁️
One shared world, works from any phone/laptop, zero installs for friends, ₹0 forever.

### Cloud backup — EASY way (zero signup, 30 sec)
1. jsonblob.com → paste `{}` in the box → **Create** → copy the link (`jsonblob.com/api/jsonBlob/…`)
2. On Render, set env `JSONBLOB_URL` = that link. Done — data auto-restores after restarts.

### Cloud backup — PRO way (Upstash, also free)
1. upstash.com → free account → **Create Database** → **REST** section → copy URL + TOKEN
2. Render env: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

### Deploy (5 minutes)
1. **render.com** → sign up **with GitHub** (no card)
2. New + → **Web Service** → pick repo `iambesttttduhh/shift` (click "Configure account" if not listed)
3. Settings:
   - **Branch:** `arena/01a06b20-shift`
   - **Runtime:** Node
   - **Build Command:** `npm install --no-audit --no-fund`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. **Advanced → Add Environment Variables:**
   - `FRFR_NO_UPDATE` = `1`
   - `ADMIN_PASSWORD` = (invent ur own admin password!)
   - `JSONBLOB_URL` = (from jsonblob.com — 30-sec setup, see above)
5. **Create Web Service** → wait ~2 min → ur app is LIVE on `https://something.onrender.com` 🎉

### Free-tier truths
- The app **sleeps** after ~15 min idle → first visitor waits ~40s (wake-up), then instant
- Every git push to the branch auto-redeploys (~2 min)
- Data auto-restores from the Upstash backup after restarts 💾
