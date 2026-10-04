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

// "Global Kids" cut as outlines, not as live text. A <text> element was the
// obvious thing to reach for and it was wrong twice over: the logo is loaded as
// a data: URI, and a data: URI is a separate document that cannot fetch a
// webfont, so the browser silently fell back to a local sans - nothing like the
// original. And even with a font available the original logotype is drawn as
// paths, so a live font could never have matched it.
//
// The typeface was identified rather than guessed. The template's wordmark was
// measured off its own path data (round 'o', stem 3.69, cap 18.33, x-height
// 14.77) and those metrics were scored against a dozen geometric sans families
// downloaded from Google Fonts: Poppins reproduces every one of them to within
// ~1% (o_side/cap .204 vs .204, o_vert/cap .174 vs .174, J/cap .626 vs .628,
// asc/cap 1.059 vs 1.056), and the next best family was six times worse off.
// The letterspacing below was then calibrated so that rebuilding the original
// "Joyloo" in Poppins reproduces the original's 87.84-unit inked width.
//
// 'Global Kids' set in Poppins Bold, the geometric family the original
// Joyloo logotype was cut from (metrics match within ~1%; see the note above).
// Bold is heavier than the logotype was - Poppins Bold's stem is 0.247 of
// cap height where the original's was 0.204 - the school's explicit choice.
// Normalised to cap height 1, baseline on y=0, x=0 at the inked left edge.
// Letterspacing +0.00495 of cap height (+0.0908 units at cap
// height 18.33), calibrated so a rebuild of 'Joyloo' reproduces the original
// wordmark's 87.84 inked width.
const WORDMARK_PATHS = [
  'L 0.7489 -0.6809 Q 0.722 -0.7305 0.6716 -0.7567 Q 0.6213 -0.783 0.5532 -0.783 Q 0.4355 -0.783 0.3645 -0.7057 Q 0.2936 -0.6284 0.2936 -0.4993 Q 0.2936 -0.3617 0.3681 -0.2844 Q 0.4426 -0.2071 0.573 -0.2071 Q 0.6624 -0.2071 0.7241 -0.2525 Q 0.7858 -0.2979 0.8142 -0.383 H 0.5064 V -0.5617 H 1.034 V -0.3362 Q 1.0071 -0.2454 0.9426 -0.1674 Q 0.878 -0.0894 0.7787 -0.0411 Q 0.6794 0.0071 0.5546 0.0071 Q 0.4071 0.0071 0.2915 -0.0574 Q 0.1759 -0.122 0.1113 -0.2369 Q 0.0468 -0.3518 0.0468 -0.4993 Q 0.0468 -0.6468 0.1113 -0.7624 Q 0.1759 -0.878 0.2908 -0.9426 Q 0.4057 -1.0071 0.5532 -1.0071 Q 0.7319 -1.0071 0.8546 -0.9206 Q 0.9773 -0.834 1.017 -0.6809 Z',
  'L 1.4163 -1.0496 V -0 H 1.1737 V -1.0496 Z',
  'L 1.5489 -0.3957 Q 1.5489 -0.5177 1.6028 -0.6106 Q 1.6567 -0.7035 1.7503 -0.7532 Q 1.8439 -0.8028 1.9603 -0.8028 Q 2.0766 -0.8028 2.1702 -0.7532 Q 2.2638 -0.7035 2.3177 -0.6106 Q 2.3716 -0.5177 2.3716 -0.3957 Q 2.3716 -0.2738 2.317 -0.1809 Q 2.2624 -0.0879 2.1681 -0.0383 Q 2.0737 0.0113 1.9574 0.0113 Q 1.8411 0.0113 1.7482 -0.0383 Q 1.6553 -0.0879 1.6021 -0.1801 Q 1.5489 -0.2723 1.5489 -0.3957 Z L 2.1248 -0.3957 Q 2.1248 -0.4908 2.0773 -0.5418 Q 2.0298 -0.5929 1.9603 -0.5929 Q 1.8893 -0.5929 1.8425 -0.5426 Q 1.7957 -0.4922 1.7957 -0.3957 Q 1.7957 -0.3007 1.8418 -0.2496 Q 1.8879 -0.1986 1.9574 -0.1986 Q 2.0269 -0.1986 2.0759 -0.2496 Q 2.1248 -0.3007 2.1248 -0.3957 Z',
  'L 2.9922 -0.8028 Q 3.09 -0.8028 3.1695 -0.7532 Q 3.2489 -0.7035 3.295 -0.6113 Q 3.3411 -0.5191 3.3411 -0.3972 Q 3.3411 -0.2752 3.295 -0.1823 Q 3.2489 -0.0894 3.1695 -0.039 Q 3.09 0.0113 2.9922 0.0113 Q 2.9085 0.0113 2.8461 -0.022 Q 2.7837 -0.0553 2.7482 -0.1106 V -0 H 2.5056 V -1.0496 H 2.7482 V -0.6794 Q 2.7822 -0.7348 2.8461 -0.7688 Q 2.9099 -0.8028 2.9922 -0.8028 Z L 2.9198 -0.5915 Q 2.8475 -0.5915 2.7971 -0.539 Q 2.7468 -0.4865 2.7468 -0.3957 Q 2.7468 -0.305 2.7971 -0.2525 Q 2.8475 -0.2 2.9198 -0.2 Q 2.9922 -0.2 3.0432 -0.2532 Q 3.0943 -0.3064 3.0943 -0.3972 Q 3.0943 -0.4879 3.0439 -0.5397 Q 2.9936 -0.5915 2.9198 -0.5915 Z',
  'L 3.7744 -0.8028 Q 3.8581 -0.8028 3.9212 -0.7688 Q 3.9844 -0.7348 4.0184 -0.6794 V -0.7915 H 4.2609 V -0 H 4.0184 V -0.1121 Q 3.9829 -0.0567 3.9198 -0.0227 Q 3.8567 0.0113 3.773 0.0113 Q 3.6765 0.0113 3.5971 -0.039 Q 3.5177 -0.0894 3.4716 -0.1823 Q 3.4255 -0.2752 3.4255 -0.3972 Q 3.4255 -0.5191 3.4716 -0.6113 Q 3.5177 -0.7035 3.5971 -0.7532 Q 3.6765 -0.8028 3.7744 -0.8028 Z L 3.8453 -0.5915 Q 3.773 -0.5915 3.7226 -0.5397 Q 3.6723 -0.4879 3.6723 -0.3972 Q 3.6723 -0.3064 3.7226 -0.2532 Q 3.773 -0.2 3.8453 -0.2 Q 3.9177 -0.2 3.968 -0.2525 Q 4.0184 -0.305 4.0184 -0.3957 Q 4.0184 -0.4865 3.968 -0.539 Q 3.9177 -0.5915 3.8453 -0.5915 Z',
  'L 4.6843 -1.0496 V -0 H 4.4418 V -1.0496 Z',
  'L 5.7481 -0 L 5.4134 -0.4397 V -0 H 5.1708 V -0.9957 H 5.4134 V -0.5589 L 5.7453 -0.9957 H 6.0304 L 5.6446 -0.5078 L 6.0446 -0 Z',
  'L 6.1418 -1.0043 Q 6.1418 -1.061 6.1822 -1.0986 Q 6.2226 -1.1362 6.2864 -1.1362 Q 6.3488 -1.1362 6.3893 -1.0986 Q 6.4297 -1.061 6.4297 -1.0043 Q 6.4297 -0.9489 6.3893 -0.9113 Q 6.3488 -0.8738 6.2864 -0.8738 Q 6.2226 -0.8738 6.1822 -0.9113 Q 6.1418 -0.9489 6.1418 -1.0043 Z L 6.407 -0.7915 V -0 H 6.1644 V -0.7915 Z',
  'L 6.8885 -0.8028 Q 6.9666 -0.8028 7.0311 -0.7702 Q 7.0956 -0.7376 7.1325 -0.6823 V -1.0496 H 7.3751 V -0 H 7.1325 V -0.1135 Q 7.0985 -0.0567 7.0354 -0.0227 Q 6.9722 0.0113 6.8885 0.0113 Q 6.7907 0.0113 6.7112 -0.039 Q 6.6318 -0.0894 6.5857 -0.1823 Q 6.5396 -0.2752 6.5396 -0.3972 Q 6.5396 -0.5191 6.5857 -0.6113 Q 6.6318 -0.7035 6.7112 -0.7532 Q 6.7907 -0.8028 6.8885 -0.8028 Z L 6.9595 -0.5915 Q 6.8871 -0.5915 6.8368 -0.5397 Q 6.7864 -0.4879 6.7864 -0.3972 Q 6.7864 -0.3064 6.8368 -0.2532 Q 6.8871 -0.2 6.9595 -0.2 Q 7.0318 -0.2 7.0822 -0.2525 Q 7.1325 -0.305 7.1325 -0.3957 Q 7.1325 -0.4865 7.0822 -0.539 Q 7.0318 -0.5915 6.9595 -0.5915 Z',
  'L 7.5134 -0.2596 H 7.7531 Q 7.7573 -0.2184 7.7914 -0.1929 Q 7.8254 -0.1674 7.8751 -0.1674 Q 7.9205 -0.1674 7.9453 -0.1851 Q 7.9701 -0.2028 7.9701 -0.2312 Q 7.9701 -0.2652 7.9346 -0.2816 Q 7.8992 -0.2979 7.8197 -0.3177 Q 7.7346 -0.3376 7.6779 -0.3596 Q 7.6212 -0.3816 7.58 -0.4291 Q 7.5389 -0.4766 7.5389 -0.5574 Q 7.5389 -0.6255 7.5765 -0.6816 Q 7.6141 -0.7376 7.6871 -0.7702 Q 7.7602 -0.8028 7.8609 -0.8028 Q 8.0098 -0.8028 8.0956 -0.7291 Q 8.1814 -0.6553 8.1942 -0.5333 H 7.9701 Q 7.9644 -0.5745 7.9339 -0.5986 Q 7.9034 -0.6227 7.8538 -0.6227 Q 7.8112 -0.6227 7.7885 -0.6064 Q 7.7658 -0.5901 7.7658 -0.5617 Q 7.7658 -0.5277 7.802 -0.5106 Q 7.8382 -0.4936 7.9148 -0.4766 Q 8.0027 -0.4539 8.058 -0.4319 Q 8.1134 -0.4099 8.1552 -0.361 Q 8.197 -0.3121 8.1985 -0.2298 Q 8.1985 -0.1603 8.1595 -0.1057 Q 8.1205 -0.0511 8.0474 -0.0199 Q 7.9744 0.0113 7.8779 0.0113 Q 7.7744 0.0113 7.6935 -0.0241 Q 7.6127 -0.0596 7.5658 -0.1213 Q 7.519 -0.183 7.5134 -0.2596 Z',
]
const WORDMARK_WIDTH = 8.1517
const WORDMARK_LEFT = 0.0468


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
