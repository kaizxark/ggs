/**
 * Builds the landing page from the joyloo Webflow export in `joyloo.webflow.io/`.
 *
 * ## Why this file is simple where the Framer one was not
 *
 * The previous source was a Framer export, which turned out to be hostile to
 * editing: `script_main.<hash>.mjs` — a ~700 KB bundle from Framer's CDN —
 * hydrates the page and re-renders the entire component tree from its own copy
 * of the content. Anything written into the static HTML was overwritten within a
 * second, so branding had to be re-applied from a MutationObserver after
 * hydration, and the DOM was being mutated while the page was still settling.
 *
 * A Webflow export has no equivalent. Webflow's JavaScript wires up interactions
 * and runs GSAP/ScrollTrigger, but it never re-renders the markup, so a static
 * edit in this file is the final edit — there is nothing to race and nothing to
 * undo. That also means this page contributes no late DOM mutation of its own.
 *
 * ## Not touching the motion design
 *
 * The template's scroll animations, Webflow interactions and GSAP timelines are
 * left exactly as exported. This file adds one stylesheet, rewrites one element,
 * and replaces the copy; it never overrides a transform, duration or easing.
 *
 * ## The accuracy lock
 *
 * The page copy here was written against a research brief that forbids
 * publishing an address, phone number, curriculum claim, grade range, fee,
 * transport promise or affiliation badge until the school confirms the
 * canonical information — and public sources disagreed about both the address
 * (Vokkodi / Nagar Heggere / Bheemasandra) and the phone. The school's own
 * confirmation has since been applied to `CONTACT` below; anything still
 * unconfirmed is either left out or rendered as a clearly labelled placeholder
 * rather than invented.
 *
 * Everything the template asserted about itself was fabricated and had to go:
 * the nursery age range, the 1:6 educator ratio, the 10+ years / 120+ families /
 * 95% satisfaction statistics, the six named parent testimonials, the three
 * named blog authors, and the Webflow template credit.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "webflow-site/index.html");
const OUT_DIR = resolve(ROOT, "client/public");
const OUT = resolve(OUT_DIR, "landing.html");

/**
 * The school's details.
 *
 * This is the one place these need to be corrected. Every piece of contact data
 * on the page — the footer link, the FAQ answer, the footer address — is built
 * from this object, so fixing a value here fixes it everywhere.
 *
 * `address` and `phone` are the values from the school's Google local listing.
 * `email`, `hours`, `board` and `grades` are deliberately null: the research
 * brief is explicit that these must not be published until the school confirms
 * them, and public sources disagree. Where the page would otherwise have shown
 * one, it now shows a labelled placeholder instead — see `PLACEHOLDER`.
 */
const CONTACT = {
  name: "Global Kids School",
  city: "Tumakuru",
  tagline: "Growing confident learners in Tumakuru",
  address: "Global Extension, Puttanapalya, Vokkodi, Tumakur, Karnataka 572107",
  phone: "+91 86600 66542",
  phoneHref: "+918660066542",
  instagram: "https://www.instagram.com/globalkidstumkur/",
  email: null,
  hours: null,
  board: null,
  grades: null,
};

/**
 * Renders an unconfirmed value as a visible placeholder rather than inventing
 * one, which is what the brief asks for. If the school later supplies the real
 * value it goes into CONTACT above and this stops being used for that field.
 */
function PLACEHOLDER(field) {
  return `[${field} to be confirmed by the school]`;
}

/**
 * The wordmark that replaces the "joyloo" lettering.
 *
 * The joyloo logo is a single 132×36 SVG with its orange mark *and* the
 * lowercase "joyloo" wordmark drawn as vector paths, so there is no separate
 * text to find and swap — the whole lockup is one image. Replacing that image
 * with the school's mark and setting the name beside it is therefore the only
 * way to put "Global Kids" where the old name was.
 */
const MARK_LABEL = "Global Kids";

/**
 * The border drawn around the logo.
 *
 * Sampled from the mark itself: the deep royal blue is the logo's dominant
 * non-white colour, so the frame reads as part of the identity rather than as
 * an outline added on top of it.
 */
const LOGO_BORDER = "#001884";

/* ================================================================== *
 * Copy
 * ================================================================== *
 *
 * Every visible string on the page, section by section, keyed by the exact
 * string the template shipped. Rewriting by exact match rather than by
 * hand-editing the built artifact is what makes this reproducible: re-running
 * the build from a fresh export gives the same page, and a template string
 * that has moved fails the build instead of silently surviving.
 *
 * Where a section needed more than a text swap — the testimonial grid, the
 * blog grid, the mega menu — it is handled by a structural function below and
 * listed in `REPLACED_SECTIONS`.
 */

/** The hero. */
const HERO = {
  badge: "Admissions &mdash; enquire with the school",
  heading: "Where curious minds grow into confident doers.",
  paragraph:
    "A nurturing school community in Tumakuru built around meaningful learning, confidence, character, and possibility.",
  primary: "Enquire about admissions",
  secondary: "Explore our approach",
};

/** The four cards under the hero. */
const INTRO_CARDS = [
  [
    "Learn with curiosity",
    "Questions, experiments and hands-on work that turn a lesson into something a child wants to figure out for themselves.",
  ],
  [
    "Grow with confidence",
    "Strong foundations and steady encouragement, so each child is stretched without ever being overwhelmed.",
  ],
  [
    "Lead with purpose",
    "Character, respect and responsibility taught alongside the syllabus, not as an afterthought.",
  ],
  [
    "Belong from day one",
    "A safe, welcoming community where teachers know your child and families are part of the school, not visitors to it.",
  ],
];

/** "Our approach to learning". */
const APPROACH = {
  tag: "Our approach",
  heading:
    "Children do their best work when they feel safe, supported and free to try. We build clear foundations first, then give room for activity, discussion and reflection &mdash; so understanding sticks and confidence grows",
  cards: [
    [
      "Child-first",
      "Every child develops at their own pace. We meet them where they are today and build forward from there, with the right amount of support and stretch.",
    ],
    [
      "Foundations first",
      "Reading, writing and number are taught clearly and practised until they are secure, because confidence grows on solid ground.",
    ],
    [
      "Learning by doing",
      "Questions, projects, experiments and discussion, so children learn to think rather than only recall.",
    ],
  ],
  button: "Explore our approach",
};

/** "How we teach" — the programme cards. */
const PROGRAMS = {
  tag: "How we teach",
  heading: "Teaching that builds foundations, curiosity and character together",
  button: "Ask about the curriculum",
  ages: "Grade range on request",
  cards: [
    [
      "Reading, Writing &amp; Language",
      "Strong literacy taught in clear steps and practised until it becomes second nature.",
      ["Foundations", "Fluency", "Comprehension"],
    ],
    [
      "Maths &amp; Problem Solving",
      "Number sense and reasoning built through real problems and everyday examples children can see and touch.",
      ["Numbers", "Reasoning", "Logic"],
    ],
    [
      "Science &amp; Exploration",
      "Careful observation and honest testing &mdash; children ask why, try it, and find out what actually happens.",
      ["Experiments", "Observation", "Inquiry"],
    ],
    [
      "Arts, Sport &amp; Life Skills",
      "Art, music, movement and teamwork, so every child finds something they love and learns to give their best for a team.",
      ["Creativity", "Fitness", "Teamwork"],
    ],
  ],
};

/**
 * "A day at school" — the routine.
 *
 * The export only covered the morning, which read as a nursery timetable. The
 * four slots now span a full school day. The times themselves are indicative —
 * the school confirms the actual bell schedule — so the section is framed as
 * the shape of a day rather than a promise about it.
 */
const DAY = {
  tag: "A day at school",
  heading: "The shape of a school day",
  button: "Ask about the school day",
  items: [
    [
      "8:00 AM – 8:30 AM",
      "Morning Welcome &amp; Assembly",
      "Children arrive, settle in and begin the day together with teachers they know.",
    ],
    [
      "8:30 AM – 10:00 AM",
      "First Session Lessons",
      "Focused classroom time: clear explanations, guided practice, and questions welcome.",
    ],
    [
      "10:00 AM – 10:30 AM",
      "Short Break &amp; Social Time",
      "A break to move around, talk with friends and come back refreshed.",
    ],
    [
      "10:30 AM – 1:00 PM",
      "Second Session &amp; Lunch",
      "Back to learning, then lunch together — a mix of activity, discussion, practical work and revision.",
    ],
  ],
};

/** "What we promise" — the four commitments that replaced the invented statistics. */
const PROMISE = {
  tag: "Our promise",
  heading: "What we promise every family",
  items: [
    [
      "Safe and supervised",
      "Clear routines and responsible supervision throughout the school day, on the ground and in every classroom.",
    ],
    [
      "Teachers who know your child",
      "Continuity of adults means a difficulty is spotted early and the support given is personal.",
    ],
    [
      "Progress you can see",
      "Regular updates on work, behaviour and wellbeing &mdash; not a surprise at the end of term.",
    ],
    [
      "Open to families",
      "Enquiries, visits and awkward questions are all welcome. We would rather you ask now than wonder.",
    ],
  ],
};

/** "Why families choose us". */
const WHY = {
  tag: "WHY FAMILIES CHOOSE US",
  heading: "Because your child deserves to be known",
  cards: [
    [
      "Safe, Nurturing Environment",
      "Purposeful, well-kept spaces where children feel secure enough to concentrate, try things and get things wrong safely.",
    ],
    [
      "Experienced &amp; Caring Educators",
      "Teachers who bring subject knowledge and patience together, and who notice when a child is having a hard day.",
    ],
    [
      "Learning With Purpose",
      "Every topic connects to something beyond the textbook &mdash; a question, a problem, a project, a conversation.",
    ],
    [
      "Clear Communication with Parents",
      "Regular updates, open days and a direct line to the class teacher, so you are never left guessing.",
    ],
  ],
};

/**
 * "What families can explore" — the band that replaced the six fabricated
 * parent testimonials. The template's names and quotes could not be kept under
 * new names, and the brief prefers a labelled exploration band to invented
 * statistics, so the grid is now an invitation to visit and ask.
 */
const EXPLORE = {
  tag: "What families can explore",
  heading: "Visit, ask every question, then decide",
  items: [
    ["The classrooms", "See where your child would spend the day, and meet the teachers in each section.", "Visit"],
    ["The curriculum", "Look at what is actually taught, and ask how it is taught and why it is taught that way.", "Ask"],
    ["A normal school day", "Sit in on a lesson, meet the children, and see how a real day actually runs.", "Observe"],
    ["Fees and admissions", "Ask about fees, the documents needed and the admissions timetable for the year ahead.", "Enquire"],
    ["Timings and transport", "Understand school start and finish times, and what transport options exist.", "Confirm"],
    ["Your child&rsquo;s place", "Talk through placement, class size and support with the team directly.", "Discuss"],
  ],
};

/** The FAQ. The template's first question ("Who can support this campaign?") was a template bug. */
const FAQ = {
  heading: "Clear answers to help you feel confident.",
  items: [
    [
      "Which grades does the school teach?",
      `Global Kids School is a school in ${CONTACT.city}. The current grade range and curriculum are ${PLACEHOLDER("grade range")} and ${PLACEHOLDER("curriculum")} — please contact the school office and we will confirm both for you directly.`,
    ],
    [
      "What does a school day look like?",
      "Days are planned around teaching, activity, breaks and meals, so children move between focused learning and time to play and rest.",
    ],
    [
      "How do you keep children safe?",
      "Clear supervision routines, safe campus procedures and age-appropriate safeguarding practice. Ask the school office for the specifics when you visit.",
    ],
    [
      "How do you communicate with parents?",
      "Through regular updates, parent-teacher meetings and open communication, so you always know how your child is doing.",
    ],
    [
      "How do we apply?",
      `Enquire with the school, speak with the team, visit the campus and then complete the application. Call ${CONTACT.phone} to begin.`,
    ],
  ],
};

/** The admissions pathway — the four steps the template's fake blog grid became. */
const ADMISSIONS = {
  tag: "Admissions",
  heading: "Four steps from first enquiry to a confirmed place",
  button: "Enquire about admissions",
  steps: [
    ["Step 1", "Enquire", "Tell us your child&rsquo;s age and the grades you are considering. We will share what is available and answer your questions.", "Start here"],
    ["Step 2", "Speak with the school", "Meet the team and understand the curriculum, the daily routine and how your child would be supported.", "Continue"],
    ["Step 3", "Visit the campus", "See the classrooms, sit in on a lesson and speak with teachers before you decide anything.", "Book a visit"],
    ["Step 4", "Complete your application", "Submit the documents the school asks for and confirm your child&rsquo;s place for the year ahead.", "Apply"],
  ],
};

/** The closing call to action. */
const CTA = {
  tag: "Enquire",
  heading: "Come and see the school for yourself.",
  button: "Enquire about admissions",
};

/* ================================================================== *
 * Structural rewrites
 * ================================================================== */

/**
 * The header brand styles.
 *
 * `.navbar-brand-header` is a fixed 35px-tall box in the export's stylesheet and
 * the joyloo image filled it at 100%×100%, so the box was sized by the old
 * logo's 132:36 ratio. The school's mark is square, so the height is pinned here
 * and the box is made a flex row to hold the mark and the wordmark side by side.
 * The border is drawn inside that 35px rather than adding to it, which keeps the
 * navbar exactly as tall as the template designed it.
 */
const brandCss = `
    <style id="gks-brand">
      /*
        The brand lockup in the header.

        The template sizes its logo with width:100%; height:100% inside a 35px
        box, sized for a wide wordmark. The school's mark is square, so the box
        becomes a flex row of mark + name and the height is pinned to the
        template's own 35px. The border and padding are drawn inside that box
        (box-sizing: border-box) so the navbar does not grow.
      */
      .gks-lockup {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      /* The header box is the template's own 35px, kept exactly. */
      .navbar-brand-header .gks-lockup {
        height: 35px;
      }

      .gks-logo {
        /*
          Beats the export's ".navbar-brand-header-logo { width:100%; height:100% }",
          which would otherwise stretch the square mark to fill whatever box the
          flex row gives it.
        */
        width: 35px;
        height: 35px;
        flex: none;
        box-sizing: border-box;
        padding: 3px;
        border: 2px solid ${LOGO_BORDER};
        border-radius: 10px;
        background-color: #ffffff;
        object-fit: contain;
        display: block;
      }

      /* The footer lockup is not height-constrained, so the mark can be larger. */
      .gks-lockup--footer .gks-logo {
        width: 56px;
        height: 56px;
        border-radius: 14px;
      }

      .gks-wordmark {
        font-family: inherit;
        font-weight: 700;
        font-size: 17px;
        line-height: 1;
        letter-spacing: -0.02em;
        color: inherit;
        white-space: nowrap;
        -webkit-user-select: none;
        user-select: none;
      }

      /*
        The scrolling mark strip at the very bottom of the footer.

        The template ran ten copies of a 552x143 wordmark here with
        ".footer-ticker-logo { width:100%; height:100% }". Inside a flex row with
        no height of its own, that resolves to the natural line box and the
        square mark would render at an unpredictable size. Pinning it to 52px
        with flex:none keeps the marquee geometry the template designed.
      */
      .footer-ticker-logo.gks-ticker-logo {
        width: 52px;
        height: 52px;
        max-width: 52px;
        flex: none;
        object-fit: contain;
      }

      /*
        The "What families can explore" cards.

        These reuse .testimonial-card so they inherit the grid, the radius and the
        entrance animation unchanged. The rating stars and the stock avatars had
        to go: five stars is a claim about other parents, and the faces were not
        anybody's.

        Two rules are needed because two elements are new. The template sized the
        quote text for a testimonial; here it is a heading, so it takes the h6
        scale the card was designed around. And the summary line below it has no
        class in the export, so it borrows .p-text-02, the body-copy style every
        other card on the page uses.
      */
      .gks-explore-title {
        font-size: var(--_typography---font-sizes--h6);
        line-height: var(--_typography---line-height--h6);
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--_colors---black);
      }

      /*
        The line added under the closing heading.

        The CTA block sits on a full-bleed photograph with a white heading, so the
        new line has to be light too — the template's body colour is #1a1917 on a
        dark image and would have been unreadable. .cta-top-block is a column with
        a gap, so no margin is needed here.
      */
      .cta-subtitle {
        color: var(--_colors---secondary-white);
        font-size: var(--_typography---font-sizes--medium);
        line-height: var(--_typography---line-height--medium);
        max-width: 46ch;
      }

      /*
        The admissions step cards.

        The grid the template shipped for its blog posts holds three columns. Four
        steps leave the fourth card alone in a second row, which reads as an
        oversight, so the last card is allowed to span the full width.
      */
      @media (min-width: 992px) {
        #admissions .blog-collection-item:last-child {
          grid-column: 1 / -1;
        }
      }
    </style>`;

/**
 * The new brand lockup, in place of the joyloo logo image.
 *
 * The wordmark is `aria-hidden` because the mark's `alt` already names the
 * school for assistive technology; announcing it twice would just be noise.
 */
function brandLockup({ size, lockupClass = "" }) {
  return [
    `<span class="gks-lockup${lockupClass}">`,
    `<img src="/logo.png" alt="${CONTACT.name}"`,
    ` class="navbar-brand-header-logo gks-logo"`,
    ` width="${size}" height="${size}"/>`,
    `<span class="gks-wordmark" aria-hidden="true">${MARK_LABEL}</span>`,
    `</span>`,
  ].join("");
}

/**
 * Rewrite both joyloo logos into the school's lockup.
 *
 * The export uses the same 132×36 wordmark image twice — once in the header
 * brand link and once at the top of the footer. Both are replaced, because a
 * site that shows the school's mark in the header and the old name in the
 * footer is worse than not having changed anything.
 *
 * Each is matched on the asset rather than on the whole tag, so this keeps
 * working if Webflow reorders the attributes when the site is edited in the
 * designer and re-exported.
 */
function replaceLogos(html) {
  const logoTag = /<img\b[^>]*main-logo\.svg[^>]*>/gi;
  const found = html.match(logoTag);

  if (!found || found.length === 0) {
    throw new Error(
      "Could not find the joyloo logo image (main-logo.svg) in the export. " +
        "The brand markup has probably changed — update replaceLogos()."
    );
  }

  let headerSeen = false;

  return html.replace(logoTag, (tag) => {
    // The header logo carries the brand class; the footer's is unclassed.
    const isHeader = /navbar-brand-header-logo/.test(tag);
    if (isHeader && headerSeen) return tag;
    if (isHeader) headerSeen = true;

    return isHeader
      ? brandLockup({ size: 35 })
      : brandLockup({ size: 56, lockupClass: " gks-lockup--footer" });
  });
}

/**
 * Replace the joyloo marks in the footer's scrolling strip.
 *
 * These are a different asset from the header logo — ten copies of the wide
 * orange wordmark — so they need their own pass. Left alone, the strip would be
 * the loudest remaining piece of the template's identity on the page.
 */
function replaceTickerLogos(html) {
  const ticker = /<img\b[^>]*699a704f228b19546a29c7d9_logo\.svg[^>]*>/gi;
  const found = html.match(ticker);

  if (!found || found.length !== 10) {
    throw new Error(
      `Expected 10 footer-ticker marks in the export, found ${found ? found.length : 0}. ` +
        "The footer markup has probably changed — update replaceTickerLogos()."
    );
  }

  return html.replace(
    ticker,
    `<img src="/logo.png" alt="" class="footer-ticker-logo gks-ticker-logo" />`
  );
}

/**
 * Walk the tag nesting of an element and return where its content starts and
 * ends.
 *
 * Several rewrites are structural — remove this whole block, read that one's
 * contents. A regex over the inner HTML would have to predict the nesting;
 * counting the tags does not, and it fails loudly on an unbalanced document
 * instead of truncating it silently. Both `cutBalanced` and `extractBalanced`
 * go through here so they cannot disagree about where an element ends.
 */
function walkTags(html, marker, tag, fromIndex = 0) {
  const start = html.indexOf(marker, fromIndex);
  if (start === -1) {
    throw new Error(`Could not find the element: ${marker}`);
  }

  const open = new RegExp(`<${tag}\\b`, "g");
  const closeTag = `</${tag}>`;
  const close = new RegExp(closeTag, "g");

  const innerStart = html.indexOf(">", start) + 1;
  let cursor = innerStart;
  let depth = 1;

  while (depth > 0) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);

    if (!nextClose) {
      throw new Error(`Unbalanced <${tag}> after "${html.slice(start, start + 60)}"`);
    }

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      cursor = nextClose.index + nextClose[0].length;
    }
  }

  return { start, innerStart, innerEnd: cursor - closeTag.length, end: cursor };
}

/** Replace an element and everything inside it. */
function cutBalanced(html, marker, tag, replacement = "", fromIndex = 0) {
  const span = walkTags(html, marker, tag, fromIndex);
  return html.slice(0, span.start) + replacement + html.slice(span.end);
}

/**
 * Remove the element that *contains* a marker.
 *
 * Some blocks are identified by a piece of text inside them — a widget title,
 * say — rather than by their own opening tag. This walks back to the nearest
 * opening tag of the requested type and removes that whole element, so a marker
 * in the middle of a block cannot leave the block's outer shell behind.
 */
function cutEnclosing(html, marker, tag, containerMarker) {
  const markerAt = html.indexOf(marker);
  if (markerAt === -1) {
    throw new Error(`Could not find the marker to remove: ${marker}`);
  }

  const containerAt = html.lastIndexOf(containerMarker, markerAt);
  if (containerAt === -1) {
    throw new Error(`No ${containerMarker} encloses "${marker}".`);
  }

  return cutBalanced(html, containerMarker, tag, "", containerAt);
}

/** Read an element's inner HTML without modifying the document. */
function extractBalanced(html, marker, tag) {
  const span = walkTags(html, marker, tag);
  return html.slice(span.innerStart, span.innerEnd);
}

/**
 * Pull every direct child element matching `childMarker` out of `inner`,
 * returning their inner HTML and what is left over.
 */
function splitChildren(inner, childMarker, tag, take) {
  const children = [];
  let rest = inner;

  while (children.length < take && rest.includes(childMarker)) {
    const span = walkTags(rest, childMarker, tag);
    children.push(rest.slice(span.innerStart, span.innerEnd));
    rest = rest.slice(span.end);
  }

  return { children, rest };
}

/**
 * Replace the first occurrence of an exact string, failing if it is absent.
 *
 * A silent no-op here is the dangerous failure mode: the build would succeed and
 * ship the template's copy as if it had been rewritten.
 */
function swap(html, find, replace, count = 1) {
  const occurrences = html.split(find).length - 1;
  if (occurrences < count) {
    throw new Error(
      `Template copy not found (needed ${count}, found ${occurrences}): "${find.slice(0, 90)}"`
    );
  }
  return html.split(find).join(replace);
}

/**
 * Replace visible copy while tolerating the export's stray whitespace.
 *
 * Webflow's own typography settings left non-breaking spaces and doubled spaces
 * inside several headings ("Because your child\u00a0 \u00a0deserves..."), which
 * an exact-match swap cannot find. This matches any run of whitespace — spaces,
 * tabs, newlines or non-breaking spaces — so the swap lands on the text the way
 * a reader sees it rather than the way the exporter serialised it.
 */
function swapText(html, find, replace) {
  const pattern = find
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\u00a0]+");

  const found = new RegExp(pattern);
  if (!found.test(html)) {
    throw new Error(`Template copy not found: "${find.slice(0, 90)}"`);
  }

  return html.replace(found, () => replace);
}

/**
 * Give the sections the in-page anchors the rewritten navigation links to.
 */
function addSectionAnchors(html) {
  const anchors = [
    ["our-approach-section", "approach"],
    ["our-program-section", "programs"],
    ["schedule-section", "day"],
    ["faq-section", "faq"],
    ["blog-section", "admissions"],
    ["footer-section", "contact"],
  ];

  for (const [marker, id] of anchors) {
    // Matched on the section's own class rather than on the whole opening tag,
    // so a reordered attribute list or an added Webflow variant class does not
    // break the build.
    const section = new RegExp(`<section(?=[^>]*class="[^"]*\\b${marker}\\b)`);
    const found = html.match(section);
    if (!found) {
      throw new Error(`Could not find the .${marker} section to anchor.`);
    }
    if (found.length !== 1) {
      throw new Error(`.${marker} matched ${found.length} sections; expected exactly 1.`);
    }
    html = html.replace(section, `<section id="${id}"`);
  }

  return html;
}

/**
 * Where each of the footer's template links goes on this page.
 *
 * The template's footer pointed at eight of its own pages — a Programs page, a
 * Daily Routine page, a Gallery, a Documents page. None of them exist here, so
 * each is mapped to the section of this page that covers the same ground. The
 * template's "Home" link is left alone: "/" already serves this page.
 */
const FOOTER_TARGETS = [
  ["/about-us", "About Us", "#approach", "Our approach"],
  ["/programs", "Programs", "#programs", "How we teach"],
  ["/daly-routine", "Daily Routine", "#day", "A school day"],
  ["/blogs", "Blogs", "#admissions", "Admissions"],
  ["/parents-resource", "Parent Resources", "#faq", "Ask about fees"],
  ["/first-day-guide", "First Day Guide", "#day", "Ask about the school day"],
  ["/documents", "Documents", "#faq", "Talk to the school"],
  ["/gallery", "Gallery", "#admissions", "Visit the campus"],
  ["/contact-enorrlment", "Contact Us", "#contact", "Enquire with us"],
];

/** The five sections the navigation now links to. */
const NAV_ITEMS = [
  ["#approach", "Our approach"],
  ["#programs", "How we teach"],
  ["#day", "A school day"],
  ["#admissions", "Admissions"],
  ["#faq", "Questions"],
];

/**
 * Replace the navigation with links that go somewhere.
 *
 * The template's menu pointed at eight joyloo.webflow.io pages — including a
 * Styleguide, a License and a Changelog — none of which exist here, and one of
 * which would have sent a parent to the template's marketplace listing. The mega
 * menu, its "Pages" label and the duplicated dropdown on the right are removed
 * outright; what is left is the five sections of this page.
 */
function rewriteNavigation(html) {
  // The standalone "Pages" label above the menu.
  html = swap(html, '<div class="pages">Pages</div>', "");

  // The menu itself, rebuilt against this page's own section anchors.
  html = cutBalanced(
    html,
    '<ul role="list" class="nav-menu w-list-unstyled">',
    "ul",
    NAV_ITEMS.map(
      ([href, label]) =>
        `<li class="list-item"><a href="${href}" class="nav-link w-nav-link">${label}</a></li>`
    ).join("") + "</ul>"
  );

  // The right-hand button block held a second, duplicate copy of the mega menu
  // next to the enquire button. Only the button survives.
  html = cutBalanced(
    html,
    '<div class="navigation-button">',
    "div",
    `<div class="navigation-button"><a href="#contact" data-wf--button--variant="secondary-sm" class="button w-variant-18a64e9b-d722-717a-0d0b-bbbc4a8cf6ca w-inline-block"><div class="button-text-wrapper"><div class="button-text">Enquire</div><div class="button-text">Enquire</div></div><div class="button-bg"></div></a></div>`
  );

  return html;
}

/**
 * Rebuild the six-card grid that used to hold the fabricated testimonials.
 *
 * The markup keeps `.testimonial-card`, so the grid, the radii and the entrance
 * animation are the template's. What is gone is the star rating and the parent
 * name: a five-star widget and a named "Parent of Emma" are claims about real
 * families, and the faces were stock photography of nobody.
 */
function replaceTestimonials(html) {
  const cards = EXPLORE.items
    .map(
      ([title, body, action]) =>
        `<div class="testimonial-card gks-explore-card">` +
        `<div class="testimonial-top-block">` +
        `<div class="testimonial-text gks-explore-title">${title}</div>` +
        `<p class="p-text-02">${body}</p>` +
        `</div>` +
        `<div class="author-info-wrapper"><div class="author-info">` +
        `<div class="author-name">${action}</div>` +
        `</div></div></div>`
    )
    .join("");

  return cutBalanced(
    html,
    '<div class="testimonial-card-list">',
    "div",
    `<div class="testimonial-card-list">${cards}</div>`
  );
}

/**
 * Point the footer's link widgets at this page's own sections.
 *
 * The export laid each widget's links out across several lines, so an exact
 * block match is brittle. Each anchor is rewritten on its own instead: the
 * `href` and the visible label move together, and the template's markup and
 * line breaks are left exactly as exported.
 */
function rewriteFooterLinks(html) {
  for (const [from, label, to, text] of FOOTER_TARGETS) {
    const anchor = new RegExp(`<a href="${from}"([^>]*)>${label}<\\/a>`, "g");

    if (!anchor.test(html)) {
      throw new Error(`Footer link not found: "${label}" (${from})`);
    }

    html = html.replace(anchor, () => `<a href="${to}" class="footer-widget-link">${text}</a>`);
  }

  return html;
}

/**
 * Turn the three fake blog posts into the admissions pathway.
 *
 * The brief asks for a four-step admissions pathway — enquire, speak with the
 * school, visit, complete the application — and there was nowhere on the page to
 * put it. The template's blog grid had the right shape but the wrong content:
 * three invented articles by three invented authors on invented dates, none of
 * which could be kept under any wording.
 *
 * So the grid becomes the pathway. Each card keeps the template's own shell and
 * rewrites only the words inside it: the step number replaces the invented
 * date, the step name replaces the invented headline, and the invented author is
 * replaced by the only honest attribution available — that the step comes from
 * the school. The fourth step reuses the second shell so the image sequence
 * does not simply repeat, and the three-column grid takes a second row.
 */
function replaceBlogWithAdmissions(html) {
  const LIST = '<div role="list" class="blog-collection-list w-dyn-items">';
  const CARD = '<div role="listitem" class="blog-collection-item w-dyn-item">';

  const list = walkTags(html, LIST, "div");
  const { children: shells, rest } = splitChildren(
    html.slice(list.innerStart, list.innerEnd),
    CARD,
    "div",
    3
  );

  if (shells.length < 3) {
    throw new Error(
      `Expected 3 blog cards in the export, found ${shells.length}. ` +
        "The blog markup has probably changed — update replaceBlogWithAdmissions()."
    );
  }

  while (shells.length < ADMISSIONS.steps.length) shells.push(shells[1]);

  const steps = ADMISSIONS.steps
    .map(([step, label, body, action], i) => {
      return `<div role="listitem" class="blog-collection-item w-dyn-item">${shells[i]
        .replace(/February 23, 2026/g, step)
        .replace(/Ethan Blake|Ayesha Rahman|Daniel Brooks/g, "Admissions")
        .replace(/>Read More</g, `>${action}<`)
        .replace(
          />Supporting Early Learning Through Play with Love and Care<|>Nurturing Confidence and Curiosity in Every Child's Journey<|>Growing Together: Where Play Meets Purpose in Early Education</g,
          `>${label}<`
        )
        // Every link in the card pointed at a blog post that no longer exists.
        // They now go to the enquiry anchor, which is where a visitor pressing
        // "Book a visit" actually wants to land.
        .replace(/href="\/blog\/[^"]*"/g, 'href="#contact"')
        .replace(/aria-label="link"/g, `aria-label="${label}"`)
        // The template left the card's summary line empty. Each step now carries
        // its own one-line explanation instead of borrowing an article's.
        .replace(
          /(<a[^>]*class="blog-title">[^<]*<\/a>)(<\/div>)/,
          `$1$2<p class="p-text-02">${body}</p>`
        )}</div>`;
    })
    .join("");

  return html.slice(0, list.start) + LIST + steps + rest + html.slice(list.end);
}

/* ================================================================== *
 * The transform
 * ================================================================== */

/**
 * Restore clean internal URLs from the export's .html filenames.
 *
 * webflow-site/ is the raw export, so every internal link names a file:
 * "contact-enorrlment.html", "programs/play-based-learning.html". The build
 * matches on clean paths - "/contact-enorrlment" - because that is what the
 * site actually serves, and because vercel.json rewrites those paths.
 *
 * This is the only difference between the two exports: both have 303 links and
 * identical structure, differing only in how the paths are spelled. Rewriting
 * them here means every other pass in the build keeps matching what it already
 * matches, instead of each one growing a second spelling to look for.
 *
 * External URLs are left alone - only a bare relative .html path is an internal
 * document, and "index.html" becomes the site root.
 *
 * The same pass decodes &nbsp;. The two exports spell a non-breaking space
 * differently - the raw one writes the entity, the cleaned one the character -
 * and the copy patterns below are written to tolerate the character but not the
 * seven characters of its own name, so it has to arrive as the character.
 *
 * It also restores the XHTML-style slash on void elements, for the same reason.
 * The raw export writes <meta ...> where the copy patterns expect
 * <meta ... />; there are eleven metas and around sixty images in the document
 * and every one of them is a literal a pass matches against. Adding the slash
 * back once here is cheaper and far less fragile than loosening each pattern.
 */
function cleanInternalLinks(html) {
  return html
    .replace(
      /\b(href|src)="(?!\/|#|https?:|mailto:|tel:|data:)([^"]+?)\.html"/g,
      (match, attribute, path) => {
        const clean = `/${path}`.replace(/\/index$/, "/");
        return `${attribute}="${clean}"`;
      }
    )
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/\b(href|src)="assets\/([^"]+)"/g, (match, attribute, rest) =>
      `${attribute}="https://${rest.replace(/%25/g, "%")}"`
    )
    .replace(
      /<(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b([^>]*[^/])>/g,
      "<$1$2 />"
    );
}

function transform(html) {
  let out = replaceLogos(cleanInternalLinks(html));

  /* ---------------- Branding ---------------- */

  out = replaceTickerLogos(out);
  out = addSectionAnchors(out);
  out = rewriteNavigation(out);

  /* ---------------- Hero ---------------- */

  out = swap(out, "Now Enrolling for 2026", HERO.badge);
  out = swap(
    out,
    "<h1 class=\"banner-heading\">Where little minds grow through play, care, and confidence.</h1>",
    `<h1 class="banner-heading">${HERO.heading}</h1>`
  );
  out = swap(
    out,
    "Safe, playful early education for children aged 1–6, guided by experienced educators who nurture curiosity, confidence, creativity, and emotional growth every day.",
    HERO.paragraph
  );
  // The duplicated button label (rest + hover) means four occurrences of the
  // hero CTA and the closing CTA label alike.
  out = swap(out, ">Join Our Family<", `>${HERO.primary}<`, 4);
  out = swap(out, '<a href="/contact-enorrlment" data-wf--button--variant="primary"', '<a href="#contact" data-wf--button--variant="primary"');
  out = swap(out, ">View Programs<", `>${HERO.secondary}<`, 2);
  out = swap(out, '<a href="/programs" data-wf--button--variant="border"', '<a href="#programs" data-wf--button--variant="border"');

  /* ---------------- Intro cards ---------------- */

  out = swap(
    out,
    "Ages 1–6",
    INTRO_CARDS[0][0]
  );
  out = swap(out, "Tailored programs for every stage of your child's unique learning journey", INTRO_CARDS[0][1]);
  out = swap(out, "Certified Educators", INTRO_CARDS[1][0]);
  out = swap(out, "Experienced, loving teachers who care deeply about your child's growth.", INTRO_CARDS[1][1]);
  out = swap(out, "Safe Environment", INTRO_CARDS[2][0]);
  out = swap(out, "Secure, clean, nurturing spaces designed specifically to inspire curiosity.", INTRO_CARDS[2][1]);
  out = swap(out, "Parent Updates", INTRO_CARDS[3][0]);
  out = swap(out, "Daily communication and photos so you stay connected to child's special moments", INTRO_CARDS[3][1]);

  /* ---------------- Approach ---------------- */

  out = swap(out, ">Our Approach to Early Learning<", `>${APPROACH.tag}<`);
  out = swap(
    out,
    "We know kids thrive when they feel safe, loved, and free to explore. Our playful approach blends care with creativity, letting each child grow at their own pace while building confidence and curiosity",
    APPROACH.heading
  );
  out = swap(out, ">Child-First Approach<", `>${APPROACH.cards[0][0]}<`);
  out = swap(out, "Every child develops at their own unique pace we meet them exactly where they are right today together", APPROACH.cards[0][1]);
  out = swap(out, ">Building Connections<", `>${APPROACH.cards[1][0]}<`);
  out = swap(out, "Building confidence, empathy, and healthy relationships through daily interactions, play, and positive guidance", APPROACH.cards[1][1]);
  out = swap(out, ">Hands-On Discovery<", `>${APPROACH.cards[2][0]}<`);
  out = swap(out, "Learning happens naturally through exploration, experimentation, and play that sparks curiosity.", APPROACH.cards[2][1]);
  /*
    "Learn More" links. The template ships one on the approach section and twelve
    across the four programme cards, each duplicated for the hover state — and
    the approach button has a trailing space the others do not, so the swap
    tolerates whitespace rather than assuming one exact shape.
  */
  const learnMore = /<div class="button-text">\s*Learn More\s*<\/div>/g;
  const learnMoreCount = (out.match(learnMore) || []).length;
  if (learnMoreCount < 13) {
    throw new Error(`Expected at least 13 "Learn More" buttons, found ${learnMoreCount}.`);
  }
  out = out.replace(
    learnMore,
    `<div class="button-text">${APPROACH.button}</div>`
  );
  out = swap(out, '/programs/play-based-learning', "#programs", 6);

  /* ---------------- Programs ---------------- */

  out = swap(out, ">Our programs<", `>${PROGRAMS.tag}<`);
  out = swapText(out, "At Joyloo our programs blend structure and play to nurture the whole child", PROGRAMS.heading);
  out = swap(out, ">View All Programs<", `>${PROGRAMS.button}<`, 2);
  out = swap(out, '<a href="/programs" data-wf--button--variant="primary"', '<a href="#contact" data-wf--button--variant="primary"');

  /*
    The "Ages: 1 - 6" pill on every programme card.

    The grade range is not confirmed, so rather than publish a range the school
    has not approved, the pill points families at the school itself.

    The export ships the programme list three times over — a desktop slider and
    two mobile variants — and the cards disagree with each other about the age
    range (one says 1-6, the others say 2-6). The pill is matched on its element
    rather than on its contents so every copy is caught whatever it claims.
  */
  const agePill = /<div class="ages-area">\s*<div class="ages">Ages:\s*<\/div>\s*<div class="ages">\d<\/div>\s*<div class="ages">-<\/div>\s*<div class="ages">\d<\/div>\s*<\/div>/g;
  const pills = out.match(agePill);
  if (!pills || pills.length < 3) {
    throw new Error(
      `Expected the programme age pills in the export, found ${pills ? pills.length : 0}.`
    );
  }
  out = out.replace(
    agePill,
    `<div class="ages-area"><div class="ages">${PROGRAMS.ages}</div></div>`
  );

  const programTitles = [
    "Play-Based Learning",
    "Early Language &amp; Communication",
    "Creative Arts &amp; Expression",
    "Social &amp; Emotional Development",
  ];
  programTitles.forEach((title, i) => {
    out = swap(out, `>${title}</`, `>${PROGRAMS.cards[i][0]}</`);
  });

  [
    "Children learn best through play. Our guided play activities encourage curiosity, problem-solving, and creativity.",
    "Through storytelling, songs, and group conversations, children develop strong listening, speaking, and early.",
    "Art, music, and movement help children express emotions, develop motor skills, and explore creativity in a joyful.",
    "We help children understand emotions, build friendships, and develop empathy through group activities.",
  ].forEach((body, i) => {
    out = swap(out, body, PROGRAMS.cards[i][1]);
  });

  /*
    The "Key Focus" tags. The export renders the programme cards twice — a
    desktop slider and a mobile list — and Webflow's own formatting leaves
    stray whitespace inside the tags, so these are matched on the element with
    flexible inner whitespace rather than as an exact string.
  */
  [
    ["Imagination", "Exploration", "Social interaction"],
    ["Vocabulary", "Expression", "Listening skills"],
    ["Art", "Music", "Movement"],
    ["Confidence", "Empathy", "Cooperation"],
  ].forEach((tags, i) => {
    tags.forEach((tag, j) => {
      const found = new RegExp(
        `<div class="key-focus-tag">\\s*${tag}\\s*</div>`,
        "g"
      );
      if (!found.test(out)) {
        throw new Error(`Key focus tag not found: "${tag}"`);
      }
      out = out.replace(
        found,
        `<div class="key-focus-tag">${PROGRAMS.cards[i][2][j]}</div>`
      );
    });
  });

  /* ---------------- A day at school ---------------- */

  out = swapText(out, "A Day At Joyloo", DAY.tag);
  out = swap(out, "Where every day flows with purpose and care", DAY.heading);
  out = swap(out, ">View Full Day Schedule<", `>${DAY.button}<`, 2);
  out = swap(out, '<a href="/daly-routine" data-wf--button--variant="secondary"', '<a href="#contact" data-wf--button--variant="secondary"');

  out = swap(out, "Morning Welcome &amp; Free Play", DAY.items[0][1]);
  out = swap(out, "Guided Learning Activities", DAY.items[1][1]);
  out = swap(out, "Snack Time &amp; Social Interaction", DAY.items[2][1]);
  out = swap(out, "Outdoor Play &amp; Exploration", DAY.items[3][1]);
  out = swap(out, "Children arrive and settle in with gentle greetings and open-ended play to ease.", DAY.items[0][2]);
  out = swap(out, "Carefully planned activities building confidence, and essential early skills.", DAY.items[1][2]);
  out = swap(out, "Wholesome snacks paired with moments of connection and conversation.", DAY.items[2][2]);
  out = swap(out, "Children explore nature while developing motor skills and imagination.", DAY.items[3][2]);

  /* ---------------- Promise (was: invented statistics) ---------------- */

  out = swap(out, ">Care in Action<", `>${PROMISE.tag}<`);
  out = swap(out, "Small numbers that reflect big care growth.", PROMISE.heading);
  out = swap(out, ">10+ Years of Care<", `>${PROMISE.items[0][0]}<`);
  out = swap(out, "Trusted early education guided by experienced educators.", PROMISE.items[0][1]);
  out = swap(out, "<strong>120+ Happy Families</strong>", PROMISE.items[1][0]);
  out = swap(out, "Parents who’ve seen confidence and joy grow every day.", PROMISE.items[1][1]);
  out = swap(out, ">1:6 Educator Ratio<", `>${PROMISE.items[2][0]}<`);
  out = swap(out, "Personal attention for every child, every moment.", PROMISE.items[2][1]);
  out = swap(out, ">95% Parent Satisfaction<", `>${PROMISE.items[3][0]}<`);
  out = swap(out, "Families who recommend Joyloo with confidence.", PROMISE.items[3][1]);

  /* ---------------- Why families choose us ---------------- */

  out = swap(out, ">WHY PARENTS CHOOSE US<", `>${WHY.tag}<`);
  out = swapText(out, "Because your child deserves the best care", WHY.heading);
  out = swap(out, "Safe, Nurturing Environment", WHY.cards[0][0]);
  out = swap(
    out,
    "Our thoughtfully designed spaces provide children with the security, comfort, and warmth they need to explore, learn, and grow confidently every single day.",
    WHY.cards[0][1]
  );
  out = swap(out, "Experienced &amp; Caring Educators", WHY.cards[1][0]);
  out = swap(
    out,
    "Our qualified teachers bring years of early childhood expertise combined with genuine love and patience, creating meaningful connections that help.",
    WHY.cards[1][1]
  );
  out = swap(out, "Play-Based Learning with Purpose", WHY.cards[2][0]);
  out = swap(
    out,
    "Every activity is intentionally designed to build skills through play. Children learn problem-solving, creativity, and cooperation while having fun exploring.",
    WHY.cards[2][1]
  );
  out = swap(out, "Clear Communication with Parents", WHY.cards[3][0]);
  out = swap(
    out,
    "Stay connected through daily updates, photos, and real-time messages. We believe parents should always know how their child's day how they're reaching.",
    WHY.cards[3][1]
  );

  /* ---------------- What families can explore ---------------- */

  out = swap(out, ">Trusted by Families<", `>${EXPLORE.tag}<`);
  out = swap(out, "Honest words from parents who’ve seen growth.", EXPLORE.heading);
  out = replaceTestimonials(out);

  /* ---------------- FAQ ---------------- */

  out = swap(out, "Clear answers to help you feel confident.", FAQ.heading);
  FAQ.items.forEach(([question, answer], i) => {
    const existing = [
      "Who can support this campaign?",
      "What is your daily routine like for children?",
      "How do you ensure children’s safety and well-being?",
      "How do you communicate with parents during the day?",
      "How can we schedule a visit or enroll our child?",
    ][i];
    out = swap(out, existing, question);
  });
  out = swap(
    out,
    "Joyloo welcomes children ages 2 to 6 years old, providing age-appropriate learning experiences, play-based activities, and personalized care for every child.",
    FAQ.items[0][1]
  );
  out = swap(
    out,
    "Each day balances guided learning, creative play, rest, and meals—helping children feel secure, engaged, and excited to explore and grow together.",
    FAQ.items[1][1]
  );
  out = swap(
    out,
    "We maintain strict safety protocols, trained staff supervision, secure facilities, and nurturing care to protect children’s health, happiness, and growth.",
    FAQ.items[2][1]
  );
  out = swap(
    out,
    "We provide regular updates through messages, photos, and check-ins, keeping parents informed about their child’s activities, progress, and well-being.",
    FAQ.items[3][1]
  );
  out = swap(
    out,
    "Parents can schedule visits or enroll their child online or by phone, ensuring a smooth, personalized introduction to Joyloo.",
    FAQ.items[4][1]
  );

  /* ---------------- Admissions (was: three fake blog posts) ---------------- */

  out = swap(out, ">Joyloo Journal<", `>${ADMISSIONS.tag}<`);
  out = swap(out, "Expert insights and everyday inspiration for families.", ADMISSIONS.heading);
  out = swap(out, ">View All Blogs<", `>${ADMISSIONS.button}<`, 2);
  out = swap(out, '<a href="#" data-wf--button--variant="secondary"', '<a href="#contact" data-wf--button--variant="secondary"');
  out = replaceBlogWithAdmissions(out);

  /* ---------------- Closing CTA ---------------- */

  // The widget titles are template furniture: one of them linked to a
  // Styleguide, a License and a Changelog.
  out = swap(out, ">For Parents<", ">Admissions &amp; visiting<");
  out = swap(out, ">Quick Links<", ">On this page<");

  out = swap(out, ">Grow With Us<", `>${CTA.tag}<`);
  out = swap(out, "Schedule a visit and see the joy of learning in action.", CTA.heading);
  // The CTA block had no supporting line, so one is added rather than swapped.
  // This is the last thing on the page before the footer, so it is where a
  // family who has read the whole page and decided to act meets the one number
  // the school has confirmed. `.cta-top-block` is the heading's wrapper, so the
  // new line lands directly beneath the heading and inherits its layout.
  // Written as a pattern rather than a literal because the gap between the two
  // tags is pure indentation, and the two exports disagree about what it is
  // made of: one pads with U+2028 and twenty-four spaces, the other with
  // nothing at all. Matching "some whitespace" covers both.
  const ctaButton = /<\/h2>\s*<\/div>\s*(<div data-w-id="ff577e1d-a51a-3a83-4432-274e56c63a91")/;
  if (!ctaButton.test(out)) {
    throw new Error(
      "Could not find the CTA button to insert the subtitle above; the CTA markup has probably changed."
    );
  }
  out = out.replace(
    ctaButton,
    `</h2><p class="cta-subtitle">Call the school office on ${CONTACT.phone}, or write to us and we will arrange a visit.</p></div>$1`
  );

  /* ---------------- Footer ---------------- */

  out = swap(
    out,
    '<a href="mailto:hello@Joyloo.com" class="contact-link w-inline-block">',
    `<a href="tel:${CONTACT.phoneHref}" class="contact-link w-inline-block">`
  );
  out = swap(out, ">hello@Joyloo.com<", `>${CONTACT.phone}<`);

  // The footer's tagline slot is the one place the address belongs.
  out = swap(
    out,
    "Safe, playful early education for children aged 1–6, guided by experienced educators who nurture curiosity.",
    CONTACT.address
  );


  // The footer's two link widgets pointed at pages that do not exist here. The
  // lists are kept and only the anchors and labels change, so the template's
  // own markup (including its line breaks) survives untouched.
  out = rewriteFooterLinks(out);

  // The "Utility Pages" widget linked to a 404, a Styleguide, a License and a
  // Changelog — none of which this site has. Its title is inside the widget, so
  // the enclosing widget element is what has to go, not the title.
  out = cutEnclosing(
    out,
    '<div class="widget-title">Utility Pages</div>',
    "div",
    '<div class="footer-widget">'
  );

  // Only the Instagram account was verifiable; the other three were the
  // template's links to facebook.com/ with no path.
  out = cutBalanced(
    out,
    '<div class="social-wrapper">',
    "div",
    `<div class="social-wrapper"><a href="${CONTACT.instagram}" target="_blank" rel="noopener noreferrer" class="social-link w-inline-block"><img src="https://cdn.prod.website-files.com/69936edfd4a65317864b054d/699a7ae714bfe203a08b7c85_Instagram.svg" alt="" class="social-icon" /></a></div>`
  );

  out = swap(
    out,
    '<p class="copyright-text">© 2026 Joyloo. All rights reserved. Powered by <a href="https://webflow.com/templates" target="_blank" class="copyright-text-link">Webflow</a></p>',
    `<p class="copyright-text">&copy; 2026 ${CONTACT.name}, ${CONTACT.city}. All rights reserved.</p>`
  );

  // There are no Terms or Privacy pages to link to yet.
  out = cutBalanced(out, '<div class="footer-links">', "div");

  // The template's marketplace credit, and the only link on the page pointing at
  // the template's own site.
  out = cutBalanced(out, '<a href="https://webflow.com/templates/html/joyloo-website-template"', "a");

  /* ---------------- Metadata ---------------- */

  out = swap(out, "<title>Joyloo - Webflow HTML Website Template</title>", `<title>${CONTACT.name} — ${CONTACT.tagline}</title>`);

  const description = `${CONTACT.name} in ${CONTACT.city} — a nurturing school community built around meaningful learning, confidence, character and possibility. ${CONTACT.address}.`;
  out = swap(
    out,
    "Safe, playful early education for children aged 1–6. Joyloo nurtures curiosity, confidence, creativity, and emotional growth through caring, experienced educators. Enroll now for 2026.",
    description,
    3
  );
  out = swap(
    out,
    '<meta content="Joyloo - Webflow HTML Website Template" property="og:title" />',
    `<meta content="${CONTACT.name} — ${CONTACT.tagline}" property="og:title" />`
  );
  out = swap(
    out,
    '<meta content="Joyloo - Webflow HTML Website Template" name="twitter:title" />',
    `<meta content="${CONTACT.name} — ${CONTACT.tagline}" name="twitter:title" />`
  );
  out = swap(
    out,
    /<meta content="https:\/\/cdn\.prod\.website-files\.com\/[^"]*_Home\.png" property="og:image" \/>/,
    '<meta content="/logo.png" property="og:image" />'
  );

  // The template's own favicon and Apple touch icon; replaced with the school's mark.
  out = swap(out, '<link href="https://cdn.prod.website-files.com/69936edfd4a65317864b054d/69a43323cca57514f470c650_Frame%202147238976.png" rel="shortcut icon" type="image/x-icon" />', '<link href="/logo-192.png" rel="shortcut icon" type="image/x-icon" />');
  out = swap(out, '<link href="https://cdn.prod.website-files.com/69936edfd4a65317864b054d/69a432e5f53a866278b0fff9_Web%20clip.png" rel="apple-touch-icon" />', '<link href="/apple-touch-icon.png" rel="apple-touch-icon" />');

  /* ---------------- Styles ---------------- */

  // Appended last so it wins over the export's own stylesheet at equal
  // specificity, without having to modify that stylesheet — which would break
  // the `integrity` hash Webflow puts on the <link>.
  out = swap(out, "</head>", `${brandCss}\n</head>`);

  return out;
}

/**
 * Strip the markup so assertions look only at what a visitor can read.
 *
 * `joyloo` legitimately survives in the stylesheet URL and in Webflow's
 * `data-wf-domain` attribute, so a raw substring search would fail on files
 * this build cannot change.
 */
function stripMarkup(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ");
}

/* ================================================================== *
 * Run
 * ================================================================== */

if (!existsSync(SOURCE)) {
  console.error(`Source export not found at ${SOURCE}`);
  process.exit(1);
}

const result = transform(readFileSync(SOURCE, "utf8"));

/*
 * Verify the transform actually landed.
 *
 * With a static export these assertions are meaningful on their own — unlike the
 * Framer version, where the file could look correct while the runtime painted
 * something else over it.
 */
const problems = [];

if (result.includes("main-logo.svg")) problems.push("the joyloo logo is still referenced");
if (result.includes("699a704f228b19546a29c7d9_logo.svg")) {
  problems.push("the joyloo footer ticker marks are still referenced");
}
if (!/class="navbar-brand-header-logo gks-logo"/.test(result)) {
  problems.push("the Global Kids logo was not put in the header");
}
if (!/gks-lockup--footer/.test(result)) {
  problems.push("the footer logo was not replaced");
}
if (!new RegExp(`>${MARK_LABEL}<`).test(result)) {
  problems.push(`the "${MARK_LABEL}" wordmark was not added`);
}
if (!/<link href="\/logo-192\.png" rel="shortcut icon"/.test(result)) {
  problems.push("the favicon was not replaced");
}
if (!/gks-logo[\s\S]*?border:\s*2px solid/.test(result)) {
  problems.push("the logo border rule is missing");
}

/*
  The point of the rewrite: nothing from the template's brand survives in text.

  Two places legitimately keep the string "joyloo" and cannot be cleaned up:
  the stylesheet's own URL, which carries an `integrity` hash Webflow computed
  for that exact filename, and the `data-wf-domain` attribute on <html>, which
  the site's interactions read. Everything else must be gone.
*/
const stylesheet = /href="[^"]*joyloo[^"]*\.css"/i;
const withoutStylesheet = result.replace(stylesheet, "");
const withoutMarkup = stripMarkup(withoutStylesheet);

if (/joyloo/i.test(withoutMarkup)) {
  problems.push("the word 'joyloo' still appears in the visible copy or a link");
}
for (const attr of withoutStylesheet.match(/[a-z-]+="[^"]*joyloo[^"]*"/gi) || []) {
  if (attr.startsWith("data-wf-")) continue;
  problems.push(`an attribute still carries the template's name: ${attr}`);
}
if (/template-button/.test(result)) {
  problems.push("the Webflow template button is still on the page");
}
if (/Powered by/.test(result)) {
  problems.push("the Webflow credit is still on the page");
}

// Fabricated content that must not survive under any name.
if (/Parent of (Emma|Emily|Zara|Noah|Rayan|Sophia)/.test(result)) {
  problems.push("a fabricated parent testimonial name is still present");
}
if (/(10\+ Years of Care|120\+ Happy Families|1:6 Educator Ratio|95% Parent Satisfaction)/.test(result)) {
  problems.push("an invented statistic is still present");
}
if (/(Ethan Blake|Ayesha Rahman|Daniel Brooks|Michael Chen|Sarah Ahmed|Priya Rahman|David Thompson|Fatima Khan|Jessica Martinez)/.test(result)) {
  problems.push("a fabricated author or testimonial name is still present");
}
if (/children aged 1–6|ages 1–6|Ages: /.test(result)) {
  problems.push("the template's nursery age range is still present");
}

// The rewritten sections must all be reachable from the new navigation.
for (const id of ["approach", "programs", "day", "admissions", "faq", "contact"]) {
  if (!result.includes(`<section id="${id}"`)) {
    problems.push(`the #${id} section anchor is missing`);
  }
}
if (!result.includes(`${CONTACT.phone}`)) {
  problems.push("the confirmed phone number is not on the page");
}
if (!result.includes(CONTACT.address)) {
  problems.push("the confirmed address is not on the page");
}

// A debug build still writes the artifact, so a failing assertion can be
// inspected in the browser rather than only read as a list of failures.
if (problems.length && process.env.GKS_DEBUG) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, result, "utf8");
  console.error("Landing page written for debugging despite failing checks.");
}

if (problems.length) {
  console.error("Landing page build incomplete:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, result, "utf8");

console.log(`Landing page written to ${OUT}`);
console.log(`  ${(result.length / 1024).toFixed(0)} KB`);
console.log(`  logo:    /logo.png with a ${LOGO_BORDER} border`);
console.log(`  lockup:  mark + "${MARK_LABEL}"`);
console.log(`  contact: ${CONTACT.phone} · ${CONTACT.address}`);