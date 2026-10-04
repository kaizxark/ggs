/**
 * Post-build step: serve the Webflow export, with two small changes.
 *
 * ## What this replaced
 *
 * The build used to run scripts/build-landing.mjs, which rewrote the export
 * into the Global Kids School landing page, and then scripts/finalise-landing.mjs,
 * which swapped that document into the root so `/` served it. Both are gone.
 * The export is served as it sits in the folder.
 *
 * ## Why the page lives under /webflow/ rather than /
 *
 * The export references its assets relatively - "assets/cdn.prod.website-files.com/..."
 * - and a browser resolves those against the document's base URL. At the root
 * that is /assets/, which is the directory Vite writes the React app's hashed
 * bundles into; those requests miss, every script is aborted, Webflow's
 * interaction library never runs, and the hero heading is left at
 * visibility:hidden.
 *
 * So vercel.json redirects / to /webflow/ rather than rewriting it. A rewrite
 * would serve the right bytes but leave the base URL at /, and the relative
 * refs would still miss. Only a redirect moves the base URL. The same applies
 * to the other pages: their links to "about-us.html" and "programs/play-based-learning.html"
 * resolve against /webflow/, which is where they are published.
 *
 * ## The changes made to each page
 *
 * 1. The template vendor's own corner button. Webflow pins a "GET THIS
 *    TEMPLATE" link to the bottom-right, pointing at webflow.com's template
 *    store. It is an advert pinned over the page, not part of the design.
 *
 * 2. The "Parents" and "pages" dropdowns in the header. Both are lists of
 *    template pages - a changelog, a licence, a styleguide, "about us
 *    templates" - that belong to the template shop rather than to a school.
 *    The real sections (Home, About Us, Programs, Gallery, Blogs) and the
 *    Contact Us button are plain links and are left alone.
 *
 * 3. The "Made in Webflow" badge. Webflow's runtime script injects
 *    <a class="w-webflow-badge"> into the body after load, so it is hidden
 *    with a display:none rule (see suppressBadge).
 *
 * 4. The rebrand. "Joyloo" becomes "Global Kids School" throughout the
 *    visible copy, and the footer's "Powered by Webflow" credit is dropped.
 *
 * All of this is applied while serving, so webflow-site/ stays exactly as it
 * is.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
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
  console.error(`Export assets missing at ${EXPORT}/assets - the pages would render unstyled.`);
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

/* ------------------------------------------------------------------ */
/* Balanced element scanning                                          */
/* ------------------------------------------------------------------ */

/**
 * Find where the element starting at `start` ends, counting nesting.
 *
 * A regex cannot do this: the nav items being removed contain <ul> and <li>
 * inside them, so the first "</li>" belongs to a child, not to the element
 * being cut, and a non-greedy match would leave the tail behind.
 */
function elementSpan(html, start, tag) {
  const open = new RegExp(`<${tag}\\b`, "gi");
  const close = new RegExp(`</${tag}>`, "gi");
  let depth = 0;
  let cursor = start;
  while (cursor < html.length) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      cursor = nextClose.index + nextClose[0].length;
      if (depth === 0) return { start, end: cursor };
    }
  }
  return null;
}

/**
 * Remove every element of `tag` whose text contains `marker`.
 *
 * Walks forward from each match and cuts whole elements, so nested markup goes
 * with them and nothing is left half-open.
 */
function removeElementsContaining(html, tag, marker) {
  const finder = new RegExp(`<${tag}\\b`, "gi");
  let out = html;
  let cursor = 0;
  let removed = 0;

  for (;;) {
    finder.lastIndex = cursor;
    const match = finder.exec(out);
    if (!match) break;
    const span = elementSpan(out, match.index, tag);
    if (!span) break;
    if (out.slice(span.start, span.end).includes(marker)) {
      out = out.slice(0, span.start) + out.slice(span.end);
      removed += 1;
      cursor = span.start;
    } else {
      cursor = span.end;
    }
  }

  return { html: out, removed };
}

/**
 * Cut the two header dropdowns.
 *
 * The desktop items are <li> elements; the mobile one is a <div class="nav-dropdown">
 * sitting beside the contact button. Both are found by the same marker, the
 * dropdown toggle, which appears nowhere else in the header.
 *
 * Only the header is scanned - the footer's own dropdown-free link columns are
 * not touched.
 */
function stripHeaderDropdowns(html) {
  if (!html.includes("nav-dropdown-toggle")) return { html, removed: 0 };

  // Not every page in the export opens with the same hero, so the header is
  // bounded by its own closing tag where there is one and by the first
  // <section> otherwise.
  const headerEnd = html.indexOf("</header>") > 0 ? html.indexOf("</header>") : html.indexOf("<section");
  if (headerEnd < 0) throw new Error("Could not bound the header to strip its dropdowns.");

  const header = html.slice(0, headerEnd);
  const tail = html.slice(headerEnd);

  // The desktop dropdowns are <li> siblings, so scanning for <li> is safe: none
  // of them wraps another.
  const items = removeElementsContaining(header, "li", "nav-dropdown-toggle");

  /*
    The mobile one is a <div class="nav-dropdown"> inside .navigation-button,
    and it has to be found from inside that block rather than from the top of
    the header. Scanning the whole header for a <div> containing the marker
    finds .header-area first - it wraps everything, so it trivially contains
    the marker - and removing it takes the entire navigation with it. The scan
    is therefore bounded to .navigation-button, where the first <div> really is
    the dropdown.
  */
  // Located in the already-shortened text, not in `header`: cutting the <li>
  // blocks moves everything after them, and an offset taken before the cut
  // points at the wrong place.
  let working = items.html;
  let mobile = 0;
  const navButton = /<div class="navigation-button">/.exec(working);
  if (navButton) {
    const outer = elementSpan(working, navButton.index, "div");
    if (outer) {
      /*
        The mobile dropdown is a <div class="nav-dropdown ..."> sitting INSIDE
        .navigation-button, as a sibling of the Contact Us button. Scanning the
        wrapper for any <div> holding the marker matches the wrapper's OWN
        opening tag first - that element trivially contains the marker - so
        removing it took the whole wrapper, and the Contact button with it.
        Instead, target the dropdown element directly and cut only that.
      */
      const inner = working.slice(outer.start, outer.end);
      const dropdown = /<div\b[^>]*\bclass="nav-dropdown(?:\s[^"]*)?"[^>]*>/.exec(inner);
      if (dropdown) {
        const dspan = elementSpan(inner, dropdown.index, "div");
        if (dspan) {
          mobile = 1;
          working =
            working.slice(0, outer.start) +
            inner.slice(0, dspan.start) +
            inner.slice(dspan.end) +
            working.slice(outer.end);
        }
      }
    }
  }

  return { html: working + tail, removed: items.removed + mobile };
}

/**
 * Re-brand the served copy.
 *
 * - Swaps the template's name for the school's. Only the capitalised "Joyloo"
 *   is rewritten: every lower-case "joyloo" in the export sits inside an
 *   attribute (the real stylesheet filename "joyloo.webflow.shared.css" and
 *   data-wf-domain), and rewriting those would break the stylesheet.
 * - Drops the vendor credit from the footer copyright ("Powered by Webflow").
 */
function rebrand(html) {
  const credits = html.match(/ Powered by\s*<a\b[^>]*>\s*Webflow\s*<\/a>/g) || [];
  return {
    html: html
      .replace(/ Powered by\s*<a\b[^>]*>\s*Webflow\s*<\/a>/g, "")
      .replace(/Joyloo/g, "Global Kids School"),
    credits: credits.length,
  };
}

/**
 * Hide the "Made in Webflow" badge.
 *
 * Webflow's runtime (webflow.schunk.*.js) appends <a class="w-webflow-badge">
 * to <body> after load, so it never exists in the served HTML - it only appears
 * in the live DOM, which is why a grep of the source never finds it. A
 * display:none rule is the only reliable way to suppress an element the page
 * creates for itself at runtime.
 */
function suppressBadge(html) {
  const style = "<style>a.w-webflow-badge{display:none!important}</style>";
  return html.includes("</head>") ? html.replace("</head>", style + "</head>") : style + html;
}

/* ------------------------------------------------------------------ */
/* Publish                                                            */
/* ------------------------------------------------------------------ */

rmSync(MOUNT, { recursive: true, force: true });
cpSync(resolve(EXPORT, "assets"), resolve(MOUNT, "assets"), { recursive: true });

const templateButton = /<a\b[^>]*class="template-button[^"]*"[\s\S]*?<\/a>/g;

/** Every page in the export, as an export-relative path. */
function exportPages(dir = EXPORT, base = "") {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = join(base, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "assets") continue;
      found.push(...exportPages(join(dir, entry.name), rel));
    } else if (entry.name.endsWith(".html")) {
      found.push(rel);
    }
  }
  return found;
}

const pages = exportPages();
if (pages.length < 10) {
  console.error(`Expected the export's full page set, found ${pages.length}.`);
  process.exit(1);
}

let totalDropdowns = 0;
let totalButtons = 0;
let totalCredits = 0;

for (const page of pages) {
  const source = readFileSync(join(EXPORT, page), "utf8");

  const buttonMatches = source.match(templateButton) || [];
  if (buttonMatches.length > 1) {
    console.error(`${page}: expected at most 1 template button, found ${buttonMatches.length}.`);
    process.exit(1);
  }
  totalButtons += buttonMatches.length;

  const stripped = removeElementsContaining(source, "a", "template-button", "template button");
  const nav = stripHeaderDropdowns(stripped.html);
  totalDropdowns += nav.removed;
  const rebranded = rebrand(nav.html);
  totalCredits += rebranded.credits;
  const served = suppressBadge(rebranded.html);

  const target = join(MOUNT, page);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, served, "utf8");

  // The rebrand must have landed, and the vendor credit must be gone.
  if (!served.includes("a.w-webflow-badge{display:none!important}")) {
    console.error(`${page}: the Webflow badge is not suppressed.`);
    process.exit(1);
  }
  if (served.includes("Joyloo")) {
    console.error(`${page}: "Joyloo" survived the rebrand.`);
    process.exit(1);
  }
  if (/Powered by/i.test(served)) {
    console.error(`${page}: a "Powered by Webflow" credit survived.`);
    process.exit(1);
  }
  // The Contact Us button lives beside the mobile dropdown; the dropdown must
  // go without taking the button with it.
  const contactBtn = 'class="button-text">Contact Us</div>';
  if (source.includes(contactBtn) && !nav.html.includes(contactBtn)) {
    console.error(`${page}: the header Contact Us button was removed.`);
    process.exit(1);
  }

  // Neither removal may survive, and the real sections must still be there.
  if (nav.html.includes("template-button") || nav.html.includes("GET THIS TEMPLATE")) {
    console.error(`${page}: the template link survived the removal.`);
    process.exit(1);
  }
  if (nav.html.includes("nav-dropdown-toggle")) {
    console.error(`${page}: a header dropdown survived the removal.`);
    process.exit(1);
  }
  if (source.includes("nav-dropdown-toggle") && nav.removed !== 3) {
    console.error(
      `${page}: expected to remove 3 header dropdowns (Parents, pages, and the mobile copy), removed ${nav.removed}.`
    );
    process.exit(1);
  }
  // The header must keep the links that are actually the site's, and the brand
  // lockup - a removal that took the whole nav would still pass every other
  // check above, so this is what catches it.
  for (const label of ["Home", "About Us", "Programs", "Gallery", "Blogs"]) {
    if (!nav.html.includes(`>${label}</a>`)) {
      console.error(`${page}: the "${label}" nav link is missing from the served header.`);
      process.exit(1);
    }
  }
  if (source.includes('class="navbar-brand-header"') && !nav.html.includes('class="navbar-brand-header"')) {
    console.error(`${page}: the brand lockup went missing from the served header.`);
    process.exit(1);
  }
  if (source.includes('navbar-wrapper') && !nav.html.includes('navbar-wrapper')) {
    console.error(`${page}: the navbar wrapper went missing from the served header.`);
    process.exit(1);
  }
}

console.log(`Published ${pages.length} pages to /webflow/`);
console.log(`  removed ${totalButtons} template buttons, ${totalDropdowns} header dropdowns, ${totalCredits} vendor credits`);
console.log("  rebranded Joyloo -> Global Kids School")
console.log("  /            -> /webflow/          webflow-site export");
console.log("  /login       app.html              React app shell");
