// Static single-page build: no server runtime, deployable to cPanel, Netlify,
// GitHub Pages, or pages.dev "static" projects.
//   bun run build:static
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { resolve } from "node:path";

function siteOrigin() {
  const vercel = process.env["VERCEL_PROJECT_PRODUCTION_URL"] ?? process.env["VERCEL_URL"];
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  const netlify = process.env["URL"] ?? process.env["DEPLOY_PRIME_URL"];
  if (netlify) return netlify.replace(/\/$/, "");
  const pages = process.env["CF_PAGES_URL"];
  if (pages) return pages.replace(/\/$/, "");
  return "";
}

export default defineConfig({
  root: resolve(process.cwd(), "static"),
  publicDir: resolve(process.cwd(), "static-public"),
  plugins: [
    react(),
    tailwindcss(),
    tsConfigPaths({ root: process.cwd() }),
    {
      name: "absolute-og-image",
      transformIndexHtml(html) {
        const origin = siteOrigin();
        const image = origin ? `${origin}/share-card.png` : "/share-card.png";
        return html.replaceAll('content="/share-card.png"', `content="${image}"`);
      },
    },
  ],
  define: { "import.meta.env.VITE_STATIC_BUILD": JSON.stringify("true") },
  resolve: { alias: { "@": resolve(process.cwd(), "src") } },
  build: {
    outDir: resolve(process.cwd(), "dist-static"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
