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

## Architecture

No build step — plain HTML/CSS/JS modules, same approach as [Workout Timer](https://github.com/elinhaggberg/workout-timer). All data lives in `localStorage` on the device.

The only server-side piece is `api/unfurl.js`, a stateless Vercel serverless function that fetches a pasted URL server-side (the browser can't read cross-origin HTML itself) and extracts Open Graph / JSON-LD metadata to build the card. It stores nothing — no database, no accounts. That keeps the "no data collection" promise true even with a link-preview feature.

## Deploying

Deploy straight from this repo on [Vercel](https://vercel.com) — no configuration needed. It auto-detects the static site plus the `api/` serverless function.
