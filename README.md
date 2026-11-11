# Daybreak Habits

A free, private habit tracker and daily planner that runs in the browser. You can install it on iPhone from Safari: Share → **Add to Home Screen**. It has no account, no subscription and no server; your data stays on the device.

It was built after a feature teardown of the App Store app "Winner Daily Habits Tracker" (see [TEARDOWN.md](TEARDOWN.md)). The code is original and doesn't copy anything from it.

## Features
- Habits with an emoji, a colour and repeat days (every day, weekdays or any set).
- One-tap check-off, a progress ring for the day and a 🔥 streak per habit.
- A week strip to view or back-fill past days.
- A daily task planner with **Copy unfinished from yesterday**.
- Stats: 7- and 30-day completion rates, best streak, a 12-week heatmap and per-habit streaks.
- 12 built-in habit suggestions (offline, no AI cost).
- Light, dark or system theme.
- A daily reminder notification (best effort; it fires while the app is open or recently used).
- JSON export and import for backups.

## Run locally
```bash
python3 -m http.server 8765 --bind 127.0.0.1
```
Then open http://127.0.0.1:8765.

## Test
```bash
node --test
```

## Put it online for free
Upload the folder to GitHub Pages, Cloudflare Pages or Netlify. They're all free for static sites. HTTPS is required for the install and offline features.

## Files
| File | Role |
|---|---|
| `core.js` | Pure logic: dates, streaks, stats, immutable state updates, import validation |
| `app.js` | UI rendering, events, localStorage, reminders, backup |
| `index.html`, `styles.css` | Layout and theme |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline support and the installable app |
| `core.test.js` | Unit tests for `core.js` |
