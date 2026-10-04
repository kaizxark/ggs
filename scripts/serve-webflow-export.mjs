/**
 * Post-build step: serve the Webflow export at the root, unmodified.
 *
 * ## What this replaced
 *
 * The build used to run scripts/build-landing.mjs, which rewrote the export
 * into the Global Kids School landing page, and then scripts/finalise-landing.mjs,
 * which swapped that document into the root so `/` served it. Both are gone from
 * the chain. webflow-site/index.html is now served exactly as it sits in the
 * folder - no copy rewriting, no branding, no markup normalisation.
 *
 * ## Why the page lives under /webflow/ rather than /
 *
 * The export references its assets relatively - "assets/cdn.prod.website-files.com/..."
 * - and a browser resolves those against the document's base URL. At the root
 * that is /assets/, which is the directory Vite writes the React app's hashed
 * bundles into; those requests miss, every script is aborted, and Webflow's
 * interaction library never runs, which leaves the hero heading stuck at
 * visibility:hidden.
 *
 * So vercel.json redirects / to /webflow/ rather than rewriting it. A rewrite
 * would serve the right bytes but leave the base URL at /, and the relative
 * refs would still miss - which is exactly what happened first. Only a
 * redirect moves the base URL, so only a redirect makes the relative paths
 * resolve to /webflow/assets/, where the export's own mirrored copies live.
 *
 * ## Why the filenames are swapped
 *
 * Vercel resolves the filesystem before it applies rewrites, and Vite always
 * writes a root index.html. Leaving that file in place would mean `/` served
 * the React shell, so it is moved to app.html and the catch-all rewrite in
 * vercel.json picks the app up from there.
 */

import { cpSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "dist/public");
const EXPORT = resolve(ROOT, "webflow-site");
const MOUNT = resolve(OUT, "webflow");

if (!existsSync(OUT)) {
  console.error(`No build output at ${OUT}. Run vite build first.`);
  process.exit(1);
}

if (!existsSync(resolve(EXPORT, "index.html"))) {
  console.error(`Export missing at ${EXPORT}/index.html.`);
  process.exit(1);
}

/*
 * The assets are not in git - 37 MB of the template's own downloads, and the
 * page references them relatively, so they have to exist at build time. The
 * deploy uploads the working directory, so they are present; a build from a
 * bare checkout would not have them. Checked explicitly rather than left to
 * fail somewhere inside the copy, because a missing asset looks like an
 * unstyled page rather than a build error.
 */
if (!existsSync(resolve(EXPORT, "assets"))) {
  console.error(`Export assets missing at ${EXPORT}/assets - the page would render unstyled.`);
  process.exit(1);
}

const INDEX = resolve(OUT, "index.html");
const APP_SHELL = resolve(OUT, "app.html");

if (existsSync(INDEX)) {
  const appShell = readFileSync(INDEX, "utf8");
  if (!/<div id="root">/.test(appShell)) {
    console.error("index.html is not the React app shell — refusing to continue.");
    process.exit(1);
  }
  renameSync(INDEX, APP_SHELL);
}

// The export's own assets, copied verbatim.
rmSync(MOUNT, { recursive: true, force: true });
cpSync(resolve(EXPORT, "assets"), resolve(MOUNT, "assets"), { recursive: true });

/*
 * The one edit this build makes: removing the template's own shopfront link.
 *
 * Webflow ships a fixed "GET THIS TEMPLATE" button pinned to the bottom-right
 * corner, linking to webflow.com's template store. It is not the school's, it
 * is not in the export's own design - it is the template vendor's advert - and
 * it sits over the page rather than in it. Removing it here rather than in the
 * export file keeps webflow-site/index.html exactly as it is in the folder.
 *
 * Matched on the element rather than its text so the arrow icon and the
 * paragraph come away with it, and anchored on the class so it cannot match
 * anything else in the document.
 */
const source = readFileSync(resolve(EXPORT, "index.html"), "utf8");

const templateButton = /<a\b[^>]*class="template-button[^"]*"[\s\S]*?<\/a>/g;
const found = source.match(templateButton) || [];
if (found.length !== 1) {
  console.error(
    `Expected exactly 1 "GET THIS TEMPLATE" element in the export, found ${found.length}. ` +
      "If the export changed, check the removal in serve-webflow-export.mjs."
  );
  process.exit(1);
}

const expected = source.replace(templateButton, "");
if (expected.length !== source.length - found[0].length) {
  console.error("The removal changed more than the template link — refusing to continue.");
  process.exit(1);
}

writeFileSync(resolve(MOUNT, "index.html"), expected, "utf8");

// Nothing else may differ from the file in the folder.
const served = readFileSync(resolve(MOUNT, "index.html"), "utf8");
if (served !== expected) {
  console.error("Served index.html does not match the export — refusing to continue.");
  process.exit(1);
}
if (served.includes("template-button") || served.includes("GET THIS TEMPLATE")) {
  console.error("The template link survived the removal — refusing to continue.");
  process.exit(1);
}

console.log("Root document resolved:");
console.log("  /            -> /webflow/          webflow-site export, minus the template link");
console.log("  /login       app.html              React app shell");
