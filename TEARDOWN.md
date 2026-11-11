# Teardown: Winner Daily Habits Tracker → Daybreak (free build)

This teardown uses only the public App Store listing (id6447870803, MAPPS Tech). It doesn't decompile the app or reuse any of its code, art or branding. Daybreak is an original app with similar mechanics.

## What Winner offers (from its listing)
| Feature | Winner | Daybreak |
|---|---|---|
| Habit tracking with streaks | Yes | Yes |
| Daily planner / tasks | Yes | Yes |
| "Copy tasks from yesterday" | Yes (v2.4.0) | Yes |
| Import tasks | Yes | Yes (JSON import/export) |
| Reminders / notifications | Yes, personalised | Browser notifications while the app is open; iOS limits apply |
| AI habit suggestions | Yes (AI assistant is Premium) | Built-in suggestion library, offline and free (no AI) |
| Light / dark theme | Yes (light added v2.4.1) | Yes, follows the system or is set by hand |
| Stats | Not described | Yes: 12-week heatmap, 7- and 30-day completion rate, best streak |
| Price | Free + $3.99/wk, $6.99/mo, $59.99/yr | Free forever, no account, data stays on the device |
| Reviews | None shown | n/a |

## How it is built for free
- A static PWA: HTML, CSS and vanilla JS with no build step and no backend.
- Data lives in `localStorage` on the device. Export/import as JSON for backup.
- A service worker makes it work offline. On iPhone, Safari → Share → Add to Home Screen gives a full-screen app icon.
- Free hosting options: GitHub Pages, Cloudflare Pages or Netlify. There's no App Store fee, which would be $99/yr for a native app.

## Later upgrades (optional)
- A native iOS app (SwiftUI + WidgetKit) for home-screen widgets and reliable reminders. Needs the $99/yr Apple developer account to ship.
- Real AI suggestions through an API (costs per call), or on-device Apple Foundation Models (iOS 26+, free).
- Sync between devices through a free tier such as Supabase or Cloudflare D1.
