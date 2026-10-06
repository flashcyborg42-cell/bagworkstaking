import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const jobs = [
  ["server/vercel/stake.ts", "api/card-stake/[ca].js"],
  ["server/vercel/og.ts", "api/card-og/[ca].js"],
  ["server/vercel/art.ts", "api/card-art/[ca].js"],
];

const footer = `
;module.exports = typeof module.exports === "function" ? module.exports : module.exports.default;
if (typeof module.exports !== "function") {
  throw new Error("Bagwork Vercel handler is not a function");
}
`;

for (const [entry, outfile] of jobs) {
  mkdirSync(dirname(resolve(outfile)), { recursive: true });
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "esbuild",
      entry,
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--target=node22",
      `--outfile=${outfile}`,
      "--legal-comments=none",
    ],
    { stdio: "inherit", shell: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  appendFileSync(outfile, footer);
}

console.log("bundled Vercel api/card-*.js as CJS");
