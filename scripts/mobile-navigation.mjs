export const MOBILE_NAV_STYLES =
  ".mobile-nav-action{display:none}" +
  "@media(max-width:991px){.pages{display:none!important}.mobile-nav-action{display:block;width:100%;margin-top:8px}.mobile-nav-action+.mobile-nav-action{margin-top:0}.mobile-nav-action .button{display:flex;width:100%;min-height:48px;align-items:center;justify-content:center}}";

export function elementSpan(html, start, tag) {
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

export function addMobileNavActions(html) {
  if (html.includes('class="mobile-nav-action"')) return html;

  const navigation = /<nav\b[^>]*class="[^"]*\bnav-menu-2\b[^"]*"[^>]*>/.exec(html);
  const actions = /<div class="navigation-button">/.exec(html);
  if (!navigation || !actions) {
    throw new Error("Could not find the header navigation or action buttons.");
  }

  const navigationSpan = elementSpan(html, navigation.index, "nav");
  const actionsSpan = elementSpan(html, actions.index, "div");
  if (!navigationSpan || !actionsSpan) {
    throw new Error("Could not locate the complete header navigation or action buttons.");
  }

  const navHtml = html.slice(navigationSpan.start, navigationSpan.end);
  const list = /<ul\b[^>]*class="[^"]*\bnav-menu\b[^"]*"[^>]*>/.exec(navHtml);
  if (!list) throw new Error("Could not find the primary links in the header navigation.");

  const listSpan = elementSpan(navHtml, list.index, "ul");
  if (!listSpan) throw new Error("Could not locate the complete primary navigation list.");

  const actionHtml = html.slice(actionsSpan.start, actionsSpan.end);
  const links = [];
  const openingAnchor = /<a\b[^>]*>/g;
  for (let match; (match = openingAnchor.exec(actionHtml)); ) {
    const anchor = elementSpan(actionHtml, match.index, "a");
    if (anchor) links.push(actionHtml.slice(anchor.start, anchor.end));
  }

  const contact = links.find((link) => link.includes('class="button-text">Contact Us</div>'));
  const login = links.find((link) => /\bhref=["']\/login["']/.test(link));
  if (!contact || !login) {
    throw new Error("Could not find both Contact Us and Login buttons for the mobile navigation.");
  }

  const mobileActions =
    `<li class="mobile-nav-action">${contact}</li>` +
    `<li class="mobile-nav-action">${login}</li>`;
  const insertAt = listSpan.end - "</ul>".length;
  const patchedNav = navHtml.slice(0, insertAt) + mobileActions + navHtml.slice(insertAt);

  return (
    html.slice(0, navigationSpan.start) +
    patchedNav +
    html.slice(navigationSpan.end)
  );
}
