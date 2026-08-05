# My Closet

A PWA to collect your body measurements, closet wishlist, links and Pinterest-style inspiration moodboards — all stored locally on your device. No ads, no data collection, no account needed.

## Why

Every app in this category leans on ads and collects data — even Pinterest itself has drifted that way. This is the opposite: a small, ad-free, local-first alternative you fully own.

## Features

- **Save anything**: paste a link (fetches the image, title and price for you) or add your own photo from your camera or library.
- **Boards**: organize saved items into Pinterest-style moodboards.
- **Wishlist**: a built-in board — toggle any saved item onto it to track price and compare its own measurements against your body measurements, with a size recommendation (snug / true to size / loose) per dimension.
- **Measurements**: log body measurement snapshots over time from Settings.
- **Home**: a "recently saved" feed across everything.
- **Backup & sharing**: export a single item, a whole board, or a full backup as a JSON file; import always merges, never replaces.
- **Cloud Backup** *(optional add-on)*: connect your own free Supabase project (via OAuth, no manual setup) for a full, passphrase-protected cloud backup and sync of everything you've saved, photos included — see `supabase/CLOUD_BACKUP_SETUP.md`. Off by default; the app works fully without it, and multiple Make It Local apps can share one Supabase project instead of needing one each.

## Architecture

No build step — plain HTML/CSS/JS modules, same approach as [Workout Timer](https://github.com/elinhaggberg/workout-timer). All data lives in `localStorage`, with photos in IndexedDB, on the device.

Two kinds of server-side pieces, both stateless and both optional except the first:

- `api/unfurl.js` and `api/proxy-image.js` — always active, stateless Vercel serverless functions. `unfurl.js` fetches a pasted URL server-side (the browser can't read cross-origin HTML itself) and extracts Open Graph / JSON-LD metadata to build the card; `proxy-image.js` relays a saved image's bytes through our own domain so the board collage export (`js/collage.js`) can draw it onto a `<canvas>` without a cross-origin CORS block. Both store nothing — no database, no accounts. That keeps the "no data collection" promise true even with these features.
- `api/oauth-*.js` and `api/cloud-sync-*.js` — inert unless Cloud Backup is turned on; thin proxies to Supabase's OAuth and Management API so the browser never needs Supabase's own API credentials directly. See `supabase/CLOUD_BACKUP_SETUP.md` if you're forking this repo and want Cloud Backup working on your own deployment — it needs a one-time OAuth application registration that can't be automated.

## Deploying

Deploy straight from this repo on [Vercel](https://vercel.com) — no configuration needed. It auto-detects the static site plus the `api/` serverless functions.

## License

[GNU AGPL-3.0](LICENSE). Free to use, copy, and modify — but any version you distribute or run as a hosted service has to stay open source too.
