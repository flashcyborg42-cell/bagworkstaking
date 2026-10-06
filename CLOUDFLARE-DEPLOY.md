# Cloudflare Pages (pages.dev)

Connect the Git repo and click Deploy. Do not type `npm run dev`.

The repo already has:

- `package.json` `"build"` → static site into `dist-static`
- `wrangler.toml` `pages_build_output_dir = "dist-static"`
- a built `dist-static/` folder in the zip, so Pages can Deploy with an empty build command
- `functions/` for `/api/public/og`, `/api/public/art`, and `/stake` (no extra npm packages required)

If the first wizard still picks Vite / `dist`, set:

- Framework preset: None
- Build command: leave empty
- Output directory: `dist-static`

Keep `static-public/wasm/resvg.wasm` (copied into `dist-static/wasm` by the build). It powers the 1200×630 X cards.

Token pages: `/stake/<contract-address>`.
