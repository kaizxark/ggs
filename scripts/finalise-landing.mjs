/**
 * Post-build step: decide which document answers `/`.
 *
 * ## Why this exists rather than a rewrite
 *
 * The obvious way to put the landing page at the root is
 *
 *     { "source": "/", "destination": "/landing.html" }
 *
 * That does not work. Vercel resolves the filesystem before it applies rewrites,
 * and Vite writes the React app's `index.html` to the root of the output
 * directory — so `/` is always served from that file and the rewrite is never
 * reached. Confirmed on the deployed site: `/` returned the SPA shell while
 * `/landing.html` served the landing page correctly.
 *
 * Swapping the filenames sidesteps the precedence question entirely:
 *
 *   dist/public/index.html  ← the landing page, so `/` serves it
 *   dist/public/app.html    ← the React app shell
 *
 * Both documents reference their assets absolutely (`/assets/...`), so neither
 * needs its contents rewritten. The SPA is then reached through the explicit
 * rewrites for `/login`, `/dashboard` and `/reset-password`, plus a catch-all.
 *
 * Runs after `vite build`, and before the server bundle is built (order in
 * package.json does not matter for that, only for this one).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "dist/public");

const INDEX = resolve(OUT, "index.html");
const LANDING = resolve(OUT, "landing.html");
const APP_SHELL = resolve(OUT, "app.html");

if (!existsSync(OUT)) {
  console.error(`No build output at ${OUT}. Run vite build first.`);
  process.exit(1);
}

if (!existsSync(LANDING)) {
  console.error(`Landing page missing at ${LANDING}. Run scripts/build-landing.mjs first.`);
  process.exit(1);
}

// Read both documents before writing anything, because one of the writes
// overwrites a file the other read depends on.
const landing = readFileSync(LANDING, "utf8");
const appShell = readFileSync(INDEX, "utf8");

// Fail loudly rather than swapping the wrong way round. The landing page is
// identified by the brand lockup that scripts/build-landing.mjs injects; the app
// shell by the React mount point Vite injects.
//
// The marker used to be the injected login button. That button is gone now that
// the logo lockup is what the transform rewrites, and a marker that no longer
// exists would have quietly turned this check into a tautology.
if (!/class="[^"]*gks-lockup/.test(landing) || !/gks-logo/.test(landing)) {
  console.error("landing.html does not contain the Global Kids brand lockup — refusing to swap.");
  process.exit(1);
}
if (!/<div id="root">/.test(appShell)) {
  console.error("index.html is not the React app shell — refusing to swap.");
  process.exit(1);
}

writeFileSync(APP_SHELL, appShell, "utf8");
writeFileSync(INDEX, landing, "utf8");

console.log("Root document resolved:");
console.log("  /            index.html   landing page");
console.log("  /login       app.html     React app shell");