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
 * 4. The rebrand. "Joyloo" becomes "Global Kids" throughout the visible
 *    copy, and the footer's "Powered by Webflow" credit is dropped.
 *
 * 5. The logo. The export's wordmark draws "Joyloo" as outlined vector paths -
 *    the letters are <path> data, never text - so it survives every text
 *    replacement and is invisible to grep. The two logo images are repointed at
 *    a "Global Kids" lockup built from the template's own roundel and brand
 *    orange, in the same two lockup geometries. See emitLogoAssets.
 *
 * 6. The "Programs" item is dropped from the header menu.
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
      .replace(/Joyloo/g, "Global Kids"),
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

/**
 * Drop a named link from the header.
 *
 * A plain nav item is a <li> holding one <a class="nav-link">. It is matched on
 * the anchor's own text so only the real menu entry is removed - the same
 * word elsewhere (a heading, a body link, the footer) is left alone.
 */
function stripNavLink(html, label) {
  // Find the menu anchor by its own text, then take out the <li> that wraps it.
  // A regex over "<li> ... </li>" would be wrong here: the gap is lazy, so it
  // happily spans from an earlier sibling's <li> across to this anchor's </li>,
  // taking the neighbouring nav items with it.
  const anchor = new RegExp(
    `<a\\b[^>]*class="[^"]*nav-link[^"]*"[^>]*>${label}<\\/a>`,
    "i"
  ).exec(html);
  if (!anchor) return { html, removed: false };

  const open = html.lastIndexOf("<li", anchor.index);
  if (open < 0) return { html, removed: false };
  const span = elementSpan(html, open, "li");
  if (!span) return { html, removed: false };

  return { html: html.slice(0, span.start) + html.slice(span.end), removed: true };
}

/**
 * Replace the template's logo with the school's own.
 *
 * The export's logo is badge-free but its wordmark is drawn as outlined vector
 * paths - the letters "Joyloo" exist as <path> data, never as text - so no
 * amount of find-and-replace in the HTML touches it. The two <img> sources are
 * repointed at the lockups emitLogoAssets writes.
 */
function swapLogo(html) {
  // The whole src, not just the filename. The export's hrefs are
  // "assets/<host>/<id>_main-logo.svg" (and, in the footer, the same file from
  // cdn.prod.website-files.com), so replacing only the trailing filename would
  // leave a stale path in front of ours.
  return html
    .replace(/(?:https?:\/\/[^'"\s]*\/)?(?:assets\/[^"'\s]*\/)?699a5a61a516cf380bf13bc4_main-logo\.svg/g, LOGO.main)
    .replace(/(?:https?:\/\/[^'"\s]*\/)?(?:assets\/[^"'\s]*\/)?699a704f228b19546a29c7d9_logo\.svg/g, LOGO.large);
}

/* ------------------------------------------------------------------ */
/* The wordmark                                                       */
/* ------------------------------------------------------------------ */

// 'Global Kids' set in Poppins SemiBold, the geometric face the original
// Joyloo logotype was cut from (metrics match within ~1%; see the note above).
// Normalised to cap height 1, baseline on y=0, x=0 at the inked left edge.
// Letterspacing +0.01777 of cap height (+0.3258 units at cap
// height 18.33), calibrated so a rebuild of 'Joyloo' reproduces the original
// wordmark's 87.84 inked width.
const WORDMARK_PATHS = [
  'M 0.7917 -0.6961 Q 0.7575 -0.7589 0.6976 -0.7917 Q 0.6377 -0.8245 0.5578 -0.8245 Q 0.4693 -0.8245 0.4009 -0.7846 Q 0.3324 -0.7447 0.2939 -0.6705 Q 0.2553 -0.5963 0.2553 -0.4993 Q 0.2553 -0.3994 0.2946 -0.3252 Q 0.3338 -0.2511 0.4037 -0.2111 Q 0.4736 -0.1712 0.5663 -0.1712 Q 0.6805 -0.1712 0.7532 -0.2318 Q 0.826 -0.2924 0.8488 -0.4009 H 0.5064 V -0.5535 H 1.0456 V -0.3795 Q 1.0257 -0.2753 0.9601 -0.1869 Q 0.8944 -0.0984 0.791 -0.0449 Q 0.6876 0.0086 0.5592 0.0086 Q 0.4151 0.0086 0.2989 -0.0563 Q 0.1826 -0.1213 0.1163 -0.2368 Q 0.0499 -0.3524 0.0499 -0.4993 Q 0.0499 -0.6462 0.1163 -0.7625 Q 0.1826 -0.8787 0.2989 -0.9437 Q 0.4151 -1.0086 0.5578 -1.0086 Q 0.7261 -1.0086 0.8502 -0.9265 Q 0.9743 -0.8445 1.0214 -0.6961 Z',
  'M 1.4115 -1.0556 V -0 H 1.2118 V -1.0556 Z',
  'M 1.5762 -0.3951 Q 1.5762 -0.5164 1.6297 -0.6091 Q 1.6832 -0.7019 1.7759 -0.7525 Q 1.8686 -0.8031 1.9828 -0.8031 Q 2.0969 -0.8031 2.1896 -0.7525 Q 2.2823 -0.7019 2.3358 -0.6091 Q 2.3893 -0.5164 2.3893 -0.3951 Q 2.3893 -0.2739 2.3344 -0.1812 Q 2.2795 -0.0884 2.186 -0.0378 Q 2.0926 0.0128 1.9771 0.0128 Q 1.8629 0.0128 1.7716 -0.0378 Q 1.6803 -0.0884 1.6283 -0.1812 Q 1.5762 -0.2739 1.5762 -0.3951 Z M 2.1839 -0.3951 Q 2.1839 -0.5078 2.1247 -0.5685 Q 2.0655 -0.6291 1.9799 -0.6291 Q 1.8943 -0.6291 1.8365 -0.5685 Q 1.7788 -0.5078 1.7788 -0.3951 Q 1.7788 -0.2825 1.8351 -0.2218 Q 1.8915 -0.1612 1.9771 -0.1612 Q 2.0313 -0.1612 2.0791 -0.1876 Q 2.1268 -0.214 2.1554 -0.2668 Q 2.1839 -0.3195 2.1839 -0.3951 Z',
  'M 3.0148 -0.8031 Q 3.1161 -0.8031 3.1981 -0.7532 Q 3.2801 -0.7033 3.3279 -0.6113 Q 3.3757 -0.5193 3.3757 -0.398 Q 3.3757 -0.2767 3.3279 -0.1833 Q 3.2801 -0.0899 3.1981 -0.0385 Q 3.1161 0.0128 3.0148 0.0128 Q 2.9264 0.0128 2.86 -0.0221 Q 2.7937 -0.0571 2.7537 -0.1127 V -0 H 2.554 V -1.0556 H 2.7537 V -0.6748 Q 2.7923 -0.7318 2.86 -0.7675 Q 2.9278 -0.8031 3.0148 -0.8031 Z M 2.962 -0.6277 Q 2.9078 -0.6277 2.86 -0.5999 Q 2.8122 -0.572 2.783 -0.5193 Q 2.7537 -0.4665 2.7537 -0.3951 Q 2.7537 -0.3238 2.783 -0.271 Q 2.8122 -0.2183 2.86 -0.1904 Q 2.9078 -0.1626 2.962 -0.1626 Q 3.0177 -0.1626 3.0654 -0.1912 Q 3.1132 -0.2197 3.1425 -0.2725 Q 3.1717 -0.3252 3.1717 -0.398 Q 3.1717 -0.4693 3.1425 -0.5214 Q 3.1132 -0.5735 3.0654 -0.6006 Q 3.0177 -0.6277 2.962 -0.6277 Z',
  'M 3.8485 -0.8031 Q 3.937 -0.8031 4.0033 -0.7675 Q 4.0697 -0.7318 4.1096 -0.6776 V -0.7903 H 4.3107 V -0 H 4.1096 V -0.1155 Q 4.0711 -0.0599 4.0033 -0.0235 Q 3.9356 0.0128 3.8471 0.0128 Q 3.7473 0.0128 3.6652 -0.0385 Q 3.5832 -0.0899 3.5354 -0.1833 Q 3.4876 -0.2767 3.4876 -0.398 Q 3.4876 -0.5178 3.5354 -0.6106 Q 3.5832 -0.7033 3.6652 -0.7532 Q 3.7473 -0.8031 3.8485 -0.8031 Z M 3.8999 -0.6277 Q 3.8443 -0.6277 3.7972 -0.6006 Q 3.7501 -0.5735 3.7209 -0.5214 Q 3.6916 -0.4693 3.6916 -0.398 Q 3.6916 -0.3267 3.7209 -0.2732 Q 3.7501 -0.2197 3.7979 -0.1912 Q 3.8457 -0.1626 3.8999 -0.1626 Q 3.9555 -0.1626 4.004 -0.1904 Q 4.0525 -0.2183 4.0811 -0.2703 Q 4.1096 -0.3224 4.1096 -0.3951 Q 4.1096 -0.4679 4.0811 -0.52 Q 4.0525 -0.572 4.004 -0.5999 Q 3.9555 -0.6277 3.8999 -0.6277 Z',
  'M 4.7237 -1.0556 V -0 H 4.524 V -1.0556 Z',
  'M 5.8576 -0 M 5.4953 -0.4437 V -0 H 5.2956 V -0.9957 H 5.4953 V -0.5492 L 5.8576 -0.9957 H 6.0987 L 5.6879 -0.5021 L 6.1101 -0 Z',
  'M 6.2378 -1.0014 Q 6.2378 -1.0514 6.2727 -1.0849 Q 6.3077 -1.1184 6.3604 -1.1184 Q 6.4132 -1.1184 6.4482 -1.0849 Q 6.4831 -1.0514 6.4831 -1.0014 Q 6.4831 -0.9515 6.4482 -0.918 Q 6.4132 -0.8845 6.3604 -0.8845 Q 6.3077 -0.8845 6.2727 -0.918 Q 6.2378 -0.9515 6.2378 -1.0014 Z M 6.4589 -0.7903 V -0 H 6.2591 V -0.7903 Z',
  'M 6.9845 -0.8031 Q 7.0615 -0.8031 7.1314 -0.7696 Q 7.2013 -0.7361 7.2427 -0.6805 V -1.0556 H 7.4453 V -0 H 7.2427 V -0.117 Q 7.2056 -0.0585 7.1385 -0.0228 Q 7.0715 0.0128 6.9831 0.0128 Q 6.8832 0.0128 6.8005 -0.0385 Q 6.7177 -0.0899 6.6699 -0.1833 Q 6.6221 -0.2767 6.6221 -0.398 Q 6.6221 -0.5178 6.6699 -0.6106 Q 6.7177 -0.7033 6.8005 -0.7532 Q 6.8832 -0.8031 6.9845 -0.8031 Z M 7.0344 -0.6277 Q 6.9788 -0.6277 6.9317 -0.6006 Q 6.8846 -0.5735 6.8554 -0.5214 Q 6.8261 -0.4693 6.8261 -0.398 Q 6.8261 -0.3267 6.8554 -0.2732 Q 6.8846 -0.2197 6.9324 -0.1912 Q 6.9802 -0.1626 7.0344 -0.1626 Q 7.09 -0.1626 7.1385 -0.1904 Q 7.187 -0.2183 7.2156 -0.2703 Q 7.2441 -0.3224 7.2441 -0.3951 Q 7.2441 -0.4679 7.2156 -0.52 Q 7.187 -0.572 7.1385 -0.5999 Q 7.09 -0.6277 7.0344 -0.6277 Z',
  'M 7.6157 -0.2496 H 7.8168 Q 7.8225 -0.204 7.8617 -0.174 Q 7.901 -0.1441 7.9595 -0.1441 Q 8.0165 -0.1441 8.0486 -0.1669 Q 8.0807 -0.1897 8.0807 -0.2254 Q 8.0807 -0.2639 8.0415 -0.2832 Q 8.0023 -0.3024 7.9167 -0.3252 Q 7.8282 -0.3466 7.7719 -0.3695 Q 7.7155 -0.3923 7.6749 -0.4394 Q 7.6342 -0.4864 7.6342 -0.5663 Q 7.6342 -0.632 7.672 -0.6862 Q 7.7098 -0.7404 7.7804 -0.7718 Q 7.851 -0.8031 7.9466 -0.8031 Q 8.0878 -0.8031 8.172 -0.7325 Q 8.2562 -0.6619 8.2647 -0.5421 H 8.0736 Q 8.0693 -0.5892 8.0343 -0.617 Q 7.9994 -0.6448 7.9409 -0.6448 Q 7.8867 -0.6448 7.8575 -0.6248 Q 7.8282 -0.6049 7.8282 -0.5692 Q 7.8282 -0.5292 7.8682 -0.5086 Q 7.9081 -0.4879 7.9923 -0.4665 Q 8.0779 -0.4451 8.1335 -0.4223 Q 8.1891 -0.3994 8.2298 -0.3516 Q 8.2704 -0.3039 8.2719 -0.2254 Q 8.2719 -0.1569 8.2341 -0.1027 Q 8.1963 -0.0485 8.1256 -0.0178 Q 8.055 0.0128 7.9609 0.0128 Q 7.8639 0.0128 7.7868 -0.0221 Q 7.7098 -0.0571 7.6649 -0.117 Q 7.6199 -0.1769 7.6157 -0.2496 Z',
]
// Inked box at cap height 1: x 0.0499 -> 8.2719, y -1.1184 -> 0.0128. The
// top is the ascender of G/b/d, which in Poppins stands 1.118x the cap height;
// the bottom is the round letters' 1.3% overshoot below the baseline.
const WORDMARK_WIDTH = 8.2220
const WORDMARK_LEFT = 0.0499

/**
 * The template's own roundel, lifted verbatim from its navbar logo SVG. It is
 * the brand mark rather than the wordmark, and it is what carries the orange.
 */
const ROUNDEL_PATHS = [
  "M18 2.3584C26.8366 2.3584 34 9.5218 34 18.3584H31.0901H25.4419C25.4419 14.2484 22.11 10.9165 18 10.9165C13.8902 10.9165 10.5581 14.2484 10.5581 18.3584H4.90828H2C2 9.5218 9.1637 2.3584 18 2.3584Z",
  "M18 34.3584C9.1637 34.3584 2 27.195 2 18.3584H4.90828H10.5581H25.4419C25.4419 22.4684 22.11 25.8003 18 25.8003C13.8902 25.8003 10.5581 22.4684 10.5581 18.3584H4.90828C4.90828 25.5883 10.7695 31.4494 17.9993 31.4494C25.2291 31.4494 31.0901 25.5883 31.0901 18.3584H34C34 27.195 26.8366 34.3584 18 34.3584Z",
];

const BRAND_ORANGE = "#F8642B";

/**
 * The two lockup geometries, as ratios of the artwork height, measured off the
 * template's own two SVGs. They are not the same ratio - the export uses a
 * proportionally larger wordmark against the roundel for the footer ticker - and
 * each is reproduced as drawn rather than unified.
 */
const LOCKUPS = {
  main: {
    name: "global-kids-logo.svg",
    roundel: { left: 2 / 36, top: 2.3584 / 36, size: 32 / 36 },
    gap: 8.91 / 36,
    baseline: 27.182 / 36,
    cap: 18.33 / 36,
    right: 1.25 / 36,
  },
  large: {
    name: "global-kids-logo-large.svg",
    roundel: { left: 7.78 / 143, top: 9.17 / 143, size: 124.44 / 143 },
    gap: 23.84 / 143,
    baseline: 111.812 / 143,
    cap: 81.78 / 143,
    right: 4.03 / 143,
  },
};

/** Where the logo files are served from; root-absolute because the export's own
 *  asset refs are relative and the pages sit at two different depths. */
const LOGO_BASE = "/webflow/";
const LOGO = {
  main: `${LOGO_BASE}${LOCKUPS.main.name}`,
  large: `${LOGO_BASE}${LOCKUPS.large.name}`,
};

/** One lockup as a standalone SVG document, at the given pixel height. */
function logoSvg(lockup, height) {
  // ROUNDEL_PATHS is the template's own navbar artwork: a 32-unit roundel sitting
  // at x=2 in a 132x36 box. Each lockup wants it at its own size and offset, so
  // it is scaled by that ratio and nudged onto the lockup's left edge.
  const markScale = (lockup.roundel.size * height) / 32;
  const markX = lockup.roundel.left * height - 2 * markScale;
  const markY = lockup.roundel.top * height - 2.3584 * markScale;
  const markRight = (lockup.roundel.left + lockup.roundel.size) * height;
  const baseline = lockup.baseline * height;
  const cap = lockup.cap * height;

  // The gap is measured ink to ink, as the template's is, so the wordmark's own
  // left sidebearing is taken back out of the pen position.
  const textX = markRight + lockup.gap * height - WORDMARK_LEFT * cap;
  const width = markRight + lockup.gap * height + WORDMARK_WIDTH * cap
    + lockup.right * height;

  const markPaths = ROUNDEL_PATHS.map(
    (d) =>
      `<path d="${d}" transform="translate(${markX.toFixed(3)} ${markY.toFixed(3)}) ` +
      `scale(${markScale.toFixed(5)})"/>`
  ).join("");
  // The outlines are normalised to cap height 1 with the baseline on y=0, so
  // the whole wordmark is one translate and one scale.
  const wordmark = WORDMARK_PATHS.map(
    (d) => `<path d="${d}" transform="translate(${textX.toFixed(2)} ${baseline.toFixed(2)}) scale(${cap.toFixed(4)})"/>`
  ).join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height}" ` +
    `viewBox="0 0 ${width.toFixed(2)} ${height}" fill="${BRAND_ORANGE}" role="img" aria-label="Global Kids">` +
    markPaths + wordmark + `</svg>`
  );
}

/**
 * Write both lockups next to the pages. Files rather than data: URIs: the
 * outlines are ~5 KB, and inlining them would add that to every one of the 31
 * pages twice over. buildLogoGuards checks they landed.
 */
function emitLogoAssets() {
  for (const key of ["main", "large"]) {
    const lockup = LOCKUPS[key];
    const height = key === "main" ? 36 : 143;
    const svg = logoSvg(lockup, height);
    if (svg.includes("NaN") || svg.includes("undefined")) {
      console.error(`The ${key} lockup did not render: ${svg.slice(0, 200)}`);
      process.exit(1);
    }
    writeFileSync(join(MOUNT, lockup.name), svg, "utf8");
  }
}

/* ------------------------------------------------------------------ */
/* Publish                                                            */
/* ------------------------------------------------------------------ */

rmSync(MOUNT, { recursive: true, force: true });
cpSync(resolve(EXPORT, "assets"), resolve(MOUNT, "assets"), { recursive: true });
emitLogoAssets();

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
  const noPrograms = stripNavLink(nav.html, "Programs");
  const rebranded = rebrand(noPrograms.html);
  totalCredits += rebranded.credits;
  const served = suppressBadge(swapLogo(rebranded.html));

  const target = join(MOUNT, page);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, served, "utf8");

  // The nav must keep its real links but lose Programs, and the Joyloo logo
  // must be gone from the markup.
  for (const label of ["Home", "About Us", "Gallery", "Blogs"]) {
    if (!served.includes(`>${label}</a>`)) {
      console.error(`${page}: the "${label}" nav link is missing.`);
      process.exit(1);
    }
  }
  // Scoped to the nav-link class: "Programs" also appears in the footer column
  // and (before removal) the mega-menu, and a whole-document check would fail
  // on those instead of on the nav item that is actually being removed.
  const programsNavLink = /<a\b[^>]*class="[^"]*nav-link[^"]*"[^>]*>Programs<\/a>/i;
  if (programsNavLink.test(source) && programsNavLink.test(served)) {
    console.error(`${page}: the "Programs" nav link survived.`);
    process.exit(1);
  }
  if (served.includes("main-logo.svg") || served.includes("699a704f228b19546a29c7d9_logo.svg")) {
    console.error(`${page}: the Joyloo logo survived.`);
    process.exit(1);
  }
  if (!served.includes(LOGO.main) || !served.includes(LOGO.large)) {
    console.error(`${page}: the Global Kids lockup was not applied.`);
    process.exit(1);
  }
  // A stale path in front of ours, or the original SVG surviving as a fallback.
  if (/assets\/[^"'\s]*\/webflow\//.test(served) || /main-logo\.svg/.test(served)) {
    console.error(`${page}: a stale logo path survived the swap.`);
    process.exit(1);
  }

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
console.log("  rebranded Joyloo -> Global Kids, swapped the logo, removed the Programs nav item")
console.log("  /            -> /webflow/          webflow-site export");
console.log("  /login       app.html              React app shell");
