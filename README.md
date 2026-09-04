# frfr. — make frens in ur city ✦

A Gen-Z style social web app for teens (13–19) across **India** to socialize and make new friends in their own city.

Create an account with your email, enter your city, and **frfr** matchmakes you with people from that exact city. **Double-tap** a profile to send a friend request (🔊 happy kitty + 💌 heart burst) — they accept or reject from their inbox. Mutual likes = instant frens → chat. No cap.

## ✨ Features

- **Email signup** (any provider — one account per mailbox, +tag/dot tricks blocked) + **login with username or email & password**
- **City-based matchmaking** — the feed only shows people from the city you entered (common aliases work too: "Bangalore" → Bengaluru, "Gurgaon" → Gurugram, …)
- **Reels-style scroll feed** — scroll profiles, flip pic galleries (up to 3, first = cover), **double-tap = friend request** with heart-burst + happy-cat dopamine; scroll past to skip
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
| GET | `/api/feed` | scrollable profiles from your city (paginated) |
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
