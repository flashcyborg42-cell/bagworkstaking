# Deploying Bagwork

Connect this repo to Netlify, Vercel, or Cloudflare Pages and click **Deploy**.
Do not type a build command. Each host reads it from the repo.

| Host | What you do | What the repo already sets |
| --- | --- | --- |
| Netlify | New site → import Git repo → Deploy | `netlify.toml` (`npm run build` → `dist-static`) |
| Vercel | Import Git repo → Deploy | `vercel.json` (`npm run build` → `dist-static`, Node functions) |
| Cloudflare Pages | Create project → connect Git → Deploy | `wrangler.toml` output `dist-static` (already built in the zip); leave the dashboard command empty |

**Never use `npm run dev` as a build command.** That starts a local server and the deploy hangs.

If Cloudflare still shows a Vite preset with output `dist`, set Framework to **None**. Leave the build command and output directory alone so `wrangler.toml` can fill them.

## What makes preview cards work

The card generator ships in each host's own function format:

- Netlify → `netlify/functions/og.ts`, `art.ts`, `stake.ts`
- Vercel → `api/og/[ca].ts`, `api/art/[ca].ts`, `api/stake/[ca].ts` (Node, not Edge)
- Cloudflare Pages → `functions/api/public/og/[ca].ts`, `functions/api/public/art/[ca].ts`, `functions/stake/[ca].ts`

PNG cards are SVG + `@resvg/resvg-wasm` (no satori). HTML tags for crawlers come from `src/lib/card-html.ts`.

- `/api/public/og/<contract>` draws the card. No version = random v2 or v3 per crawl. `?v=2` / `?v=3` / `?v2` / `?v3` forces one.
- `/stake/<contract>` is served with that token's title, description and card in the head.
- If a token cannot be loaded, `share-card.png` is served instead.

`dist-static/wasm/resvg.wasm` is produced by the build and required at runtime.

## Approved card templates

- **v2:** hourly staking card
- **v3:** “The Bag Remembered” claim card

Samples live in `samples/`.

## Plain cPanel (no Node, no functions)

Run `npm install && npm run build` locally, then upload `dist-static/` to `public_html`.
Cards fall back to `share-card.png` unless you point at a function host:

```bash
VITE_CARD_ORIGIN=https://your-project.pages.dev npm run build
```

## Optional server build

`npm run build:server` is the TanStack Start / Cloudflare Workers build. You do not need it for Netlify, Vercel, or pages.dev.
