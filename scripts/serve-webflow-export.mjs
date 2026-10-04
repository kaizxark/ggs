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

import { cpSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
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

// The export and its mirrored assets, copied verbatim.
rmSync(MOUNT, { recursive: true, force: true });
cpSync(resolve(EXPORT, "index.html"), resolve(MOUNT, "index.html"));
cpSync(resolve(EXPORT, "assets"), resolve(MOUNT, "assets"), { recursive: true });

// Byte-for-byte check: the served document must be the file in the folder.
const source = readFileSync(resolve(EXPORT, "index.html"));
const served = readFileSync(resolve(MOUNT, "index.html"));
if (!source.equals(served)) {
  console.error("Served index.html differs from webflow-site/index.html — refusing to continue.");
  process.exit(1);
}

console.log("Root document resolved:");
console.log("  /            -> /webflow/          webflow-site export, unmodified");
console.log("  /login       app.html              React app shell");
