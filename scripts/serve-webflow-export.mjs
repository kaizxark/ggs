/**
 * Post-build step: publish the modern React application shell to index.html and app.html.
 *
 * This completely eliminates the bloated legacy Webflow template export,
 * ensuring that both `/` (index.html) and rewritten routes (/login, /dashboard,
 * /mdview via app.html) serve the authentic, anti-slop Global Kids School
 * application.
 */

import { cpSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "dist/public");
const INDEX = resolve(OUT, "index.html");
const APP_SHELL = resolve(OUT, "app.html");

if (!existsSync(OUT)) {
  console.error(`No build output at ${OUT}. Run vite build first.`);
  process.exit(1);
}

if (!existsSync(INDEX)) {
  console.error(`index.html missing at ${INDEX}.`);
  process.exit(1);
}

const appShell = readFileSync(INDEX, "utf8");
if (!/<div id="root">/.test(appShell)) {
  console.error("index.html is not the React app shell — refusing to continue.");
  process.exit(1);
}

// Preserve index.html for root requests (/) and mirror to app.html for Vercel SPA rewrites
cpSync(INDEX, APP_SHELL);

console.log("✓ Published clean Global Kids application shell to index.html & app.html");
