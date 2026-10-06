import { existsSync } from "node:fs";

const leftovers = [
  ["api/art/[ca].js", "api/art/[ca].ts"],
  ["api/og/[ca].js", "api/og/[ca].ts"],
  ["api/stake/[ca].js", "api/stake/[ca].ts"],
];

const conflict = leftovers.some(([js, ts]) => existsSync(js) && existsSync(ts));
if (conflict) {
  console.log("Skipping Vercel build until leftover api/[name]/[ca].ts is removed");
  process.exit(0);
}
process.exit(1);
