import fs from "node:fs";

const path = new URL("../client/src/index.css", import.meta.url);
let css = fs.readFileSync(path, "utf8");

const tokenBlock = `@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Mono:wght@400;500;600&family=Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap");
@import "tailwindcss";

:root {
  --font-sans: "Noto Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Noto Sans Mono", ui-monospace, monospace;
  font-family: var(--font-sans);
  color: var(--text-primary);
  background: var(--bg-page);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --apple-spring: cubic-bezier(0.16, 1, 0.3, 1);

  --bg-page: #f4f4f5;
  --bg-sidebar: #ececee;
  --bg-panel: #ffffff;
  --bg-panel-solid: #ffffff;
  --bg-input: #ffffff;
  --bg-hover: rgba(24, 24, 27, 0.05);
  --bg-raised: #f4f4f5;
  --bg-card: #ffffff;

  --border: rgba(24, 24, 27, 0.10);
  --border-strong: rgba(24, 24, 27, 0.16);
  --border-subtle: rgba(24, 24, 27, 0.07);
  --border-accent: rgba(24, 24, 27, 0.22);
  --border-hover: rgba(24, 24, 27, 0.28);

  --text-primary: #18181b;
  --text-secondary: #3f3f46;
  --text-muted: #71717a;
  --text-faint: #a1a1aa;
  --text-hover: #09090b;

  --brand: #18181b;
  --brand-gradient: #18181b;
  --brand-soft: rgba(24, 24, 27, 0.08);
  --brand-soft-2: rgba(24, 24, 27, 0.045);
  --brand-border: rgba(24, 24, 27, 0.22);
  --brand-strong: #09090b;

  --success: #16794d;
  --success-soft: rgba(22, 121, 77, 0.12);
  --success-soft-2: rgba(22, 121, 77, 0.07);
  --success-border: rgba(22, 121, 77, 0.28);
  --success-strong: #0f5e3a;
  --success-bg: #18181b;
  --success-bg-hover: #09090b;

  --warning: #b45309;
  --warning-soft: rgba(180, 83, 9, 0.12);
  --warning-soft-2: rgba(180, 83, 9, 0.07);
  --warning-border: rgba(180, 83, 9, 0.28);
  --warning-strong: #92400e;

  --danger: #b42318;
  --danger-soft: rgba(180, 35, 24, 0.12);
  --danger-soft-2: rgba(180, 35, 24, 0.07);
  --danger-border: rgba(180, 35, 24, 0.28);
  --danger-strong: #912018;

  --info: #3f3f46;
  --info-soft: rgba(63, 63, 70, 0.10);
  --info-soft-2: rgba(63, 63, 70, 0.06);
  --info-border: rgba(63, 63, 70, 0.22);
  --info-strong: #18181b;

  --violet: #52525b;
  --violet-soft: rgba(82, 82, 91, 0.10);
  --violet-soft-2: rgba(82, 82, 91, 0.06);
  --violet-border: rgba(82, 82, 91, 0.22);
  --violet-strong: #3f3f46;

  --orange: #b45309;
  --orange-soft: rgba(180, 83, 9, 0.12);
  --orange-soft-2: rgba(180, 83, 9, 0.07);
  --orange-border: rgba(180, 83, 9, 0.28);
  --orange-strong: #92400e;

  --highlight: #18181b;
  --highlight-soft: rgba(24, 24, 27, 0.08);
  --highlight-soft-2: rgba(24, 24, 27, 0.045);
  --highlight-border: rgba(24, 24, 27, 0.22);
  --highlight-strong: #09090b;

  --text-table: #3f3f46;
  --text-table-bright: #18181b;

  --skeleton-base: rgba(24, 24, 27, 0.07);
  --skeleton-sheen: rgba(24, 24, 27, 0.12);
  --skeleton-sheen-strong: rgba(24, 24, 27, 0.18);

  --shadow-popover: 0 8px 24px rgba(24, 24, 27, 0.10);
  --radius-control: 8px;
  --radius-panel: 10px;
}

`;

css = css.replace(
  /^[\s\S]*?\/\* ---------- Apple Frosted Skeletons ---------- \*\/[\s\S]*?^}\n/m,
  tokenBlock
);

css = css.replace(/calc\(([^()]+?)\s*\/\s*var\(--ui-zoom\)\)/g, "$1");
css = css.replace(/\n\s*zoom:\s*var\(--ui-zoom\);/g, "");
css = css.replace(/\n\s*zoom:\s*1\s*!important;/g, "");
css = css.replace(/\n\s*--ui-zoom:\s*1;/g, "");
css = css.replace(/\s*backdrop-filter:[^;]+;/g, "");
css = css.replace(/\s*-webkit-backdrop-filter:[^;]+;/g, "");

css = css.replace(
  /-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "DM Sans", system-ui, sans-serif/g,
  "var(--font-sans)"
);
css = css.replace(
  /-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif/g,
  "var(--font-sans)"
);
css = css.replace(/"Manrope", "DM Sans", sans-serif/g, "var(--font-sans)");
css = css.replace(/Manrope, sans-serif/g, "var(--font-sans)");
css = css.replace(/font-family: Manrope, sans-serif/g, "font-family: var(--font-sans)");

css = css.replace(/rgba\(10,\s*132,\s*255,\s*([^)]+)\)/g, "rgba(24, 24, 27, $1)");
css = css.replace(/#0a84ff/g, "var(--brand)");
css = css.replace(/#0071e3/g, "var(--brand-strong)");
css = css.replace(/#409cff/g, "var(--brand-strong)");
css = css.replace(/#30d158/g, "var(--success)");
css = css.replace(/#34c759/g, "var(--success-strong)");
css = css.replace(/#64d2ff/g, "var(--info)");
css = css.replace(/#bf5af2/g, "var(--violet)");
css = css.replace(/#ff453a/g, "var(--danger)");
css = css.replace(/#ff9f0a/g, "var(--warning)");
css = css.replace(/#f87171/g, "var(--danger)");

css = css.replace(/background:\s*#15171e;/g, "background: var(--bg-panel);");
css = css.replace(/background:\s*#0e0f12;/g, "background: var(--bg-page);");
css = css.replace(/background:\s*#151619;/g, "background: var(--bg-panel);");

css = css.replace(/, inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*[0-9.]+\)/g, "");
css = css.replace(/, inset 0 0\.5px 0 rgba\(255,\s*255,\s*255,\s*[0-9.]+\)/g, "");
css = css.replace(/inset -1px 0 0 rgba\(255,\s*255,\s*255,\s*[0-9.]+\)/g, "none");
css = css.replace(/inset 1px 0 0 rgba\(255,\s*255,\s*255,\s*[0-9.]+\)/g, "none");
css = css.replace(/inset 0 -1px 0 rgba\(255,\s*255,\s*255,\s*[0-9.]+\)/g, "none");

css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[2-8]\)/g, "rgba(24, 24, 27, 0.04)");
css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.09\)/g, "rgba(24, 24, 27, 0.05)");
css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.1[0-4]\)/g, "rgba(24, 24, 27, 0.06)");
css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.1[5-9]\)/g, "rgba(24, 24, 27, 0.08)");
css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.2[0-9]\)/g, "rgba(24, 24, 27, 0.10)");

css = css.replace(/0 8px 24px -2px rgba\(0,\s*0,\s*0,\s*0\.42\)/g, "none");
css = css.replace(/0 4px 16px rgba\(0,\s*0,\s*0,\s*0\.25\)/g, "none");
css = css.replace(/0 4px 13px rgba\(0,0,0,\.25\)/g, "none");
css = css.replace(/0 18px 44px rgba\(0,0,0,\.65\)/g, "var(--shadow-popover)");
css = css.replace(/0 24px 64px rgba\(0,0,0,\.7\)/g, "var(--shadow-popover)");
css = css.replace(/0 24px 80px rgba\(0,0,0,\.75\)/g, "var(--shadow-popover)");
css = css.replace(/0 12px 30px rgba\(0,0,0,\.5\)/g, "var(--shadow-popover)");
css = css.replace(/10px 0 30px rgba\(0,0,0,\.5\)/g, "8px 0 24px rgba(24,24,27,.12)");
css = css.replace(/-14px 0 35px rgba\(0,0,0,\.6\)/g, "-8px 0 24px rgba(24,24,27,.12)");
css = css.replace(/0 2px 8px rgba\(0,0,0,\.35\)/g, "none");
css = css.replace(/0 2px 7px rgba\(0,0,0,\.35\)/g, "none");
css = css.replace(/0 2px 8px rgba\(0,\s*0,\s*0,\s*0\.42\)/g, "none");
css = css.replace(/0 4px 10px rgba\(0,0,0,\.4\)/g, "none");

css = css.replace(
  /\.dashboard-overview \{ --text-muted: rgba\(235, 235, 245, 0\.55\); \}\n/,
  ""
);
css = css.replace(
  /html \{\n  background: var\(--bg-page\);\n  scrollbar-width: none;\n  -ms-overflow-style: none;\n  -webkit-tap-highlight-color: transparent;\n\}/,
  `html {
  background: var(--bg-page);
  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.28) transparent;
  -webkit-tap-highlight-color: transparent;
}`
);
css = css.replace(
  /::-webkit-scrollbar \{ display: none; width: 0; height: 0; \}\n\.sidebar-nav, \.main-area, \.table-scroll, \.command-content, \.app-dialog, \.profile-drawer \{ scrollbar-width: none; -ms-overflow-style: none; \}/,
  `::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: rgba(24, 24, 27, 0.22); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
.sidebar-nav, .main-area, .table-scroll, .command-content, .app-dialog, .profile-drawer { scrollbar-width: thin; }`
);

css = css.replace(
  /\.min-h-screen \{ min-height: calc\(100vh \/ var\(--ui-zoom\)\); min-height: calc\(100dvh \/ var\(--ui-zoom\)\); \}/,
  ".min-h-screen { min-height: 100vh; min-height: 100dvh; }"
);
css = css.replace(
  /\.erp-app \{ height: calc\(100vh \/ var\(--ui-zoom\)\); height: calc\(100dvh \/ var\(--ui-zoom\)\); overflow: hidden;  background: var\(--bg-page\);/,
  ".erp-app { height: 100vh; height: 100dvh; overflow: hidden; background: var(--bg-page);"
);

css = css.replace(
  /\.sidebar \{ position: fixed; inset: 0 auto 0 0; z-index: 30; display: flex; width: 246px; flex-direction: column; border-right: 1px solid var\(--border\); background: var\(--bg-sidebar\); box-shadow: none; transition: transform \.22s var\(--ease-out\); \}/,
  ".sidebar { position: fixed; inset: 0 auto 0 0; z-index: 30; display: flex; width: 232px; flex-direction: column; border-right: 1px solid var(--border); background: var(--bg-sidebar); transition: transform .22s var(--ease-out); }"
);
css = css.replace(
  /\.main-area \{ height: 100vh; height: 100dvh; margin-left: 246px;/,
  ".main-area { height: 100vh; height: 100dvh; margin-left: 232px;"
);
css = css.replace(/width: 246px; transform: translateX\(-100%\);/, "width: 232px; transform: translateX(-100%);");

css = css.replace(
  /\.topbar \{ position: sticky; top: 0; z-index: 20; display: flex; min-height: 64px; align-items: center; justify-content: space-between; gap: 18px; border-bottom: 1px solid var\(--border\); background: rgba\(14, 15, 18, 0\.75\); padding: 0 35px; box-shadow: none; \}/,
  ".topbar { position: sticky; top: 0; z-index: 20; display: flex; min-height: 52px; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border); background: var(--bg-page); padding: 0 28px; }"
);
css = css.replace(/background: rgba\(14, 15, 18, 0\.75\);/g, "background: var(--bg-page);");

css = css.replace(
  /\.nav-item\.active \{ background: var\(--brand-soft\); color: var\(--brand-strong\); font-weight: 600; box-shadow: none; \}/,
  ".nav-item.active { background: var(--bg-panel); color: var(--text-primary); font-weight: 600; box-shadow: inset 2px 0 0 var(--brand); }"
);

css = css.replace(
  /\.brand-logo \{ display: block; height: 52px; width: 52px; flex: 0 0 auto; border-radius: 50%; \}/,
  ".brand-logo { display: block; height: 32px; width: 32px; flex: 0 0 auto; border-radius: 50%; }"
);
css = css.replace(
  /\.brand-wordmark-line2 \{ color: var\(--brand\); font-size: 12\.5px; font-weight: 600; letter-spacing: 0\.02em; \}/,
  ".brand-wordmark-line2 { color: var(--text-muted); font-size: 12px; font-weight: 500; letter-spacing: 0.01em; }"
);

css = css.replace(
  /\.page-title \{ margin: 8px 0 0; color: var\(--text-primary\); font-family: var\(--font-sans\); font-size: clamp\(27px, calc\(3vw \/ var\(--ui-zoom\)\), 34px\); font-weight: 700; letter-spacing: -\.04em; line-height: 1\.06; font-optical-sizing: auto; text-wrap: balance; \}/,
  ".page-title { margin: 4px 0 0; color: var(--text-primary); font-family: var(--font-sans); font-size: 22px; font-weight: 600; letter-spacing: -.02em; line-height: 1.2; text-wrap: balance; }"
);
css = css.replace(
  /font-size: clamp\(27px, 3vw, 34px\); font-weight: 700; letter-spacing: -\.04em;/,
  "font-size: 22px; font-weight: 600; letter-spacing: -.02em;"
);

css = css.replace(/border-radius: 16px/g, "border-radius: 10px");
css = css.replace(/border-radius: 18px/g, "border-radius: 12px");
css = css.replace(/border-radius: 14px/g, "border-radius: 10px");

css = css.replace(
  /\.primary-button \{ border: 1px solid rgba\(255, 255, 255, 0\.16\); background: var\(--brand\); color: #ffffff; box-shadow: 0 1px 2px rgba\(0, 0, 0, 0\.35\); \}/,
  ".primary-button { border: 1px solid var(--brand); background: var(--brand); color: #ffffff; box-shadow: none; }"
);
css = css.replace(
  /\.primary-button:hover \{ background: var\(--brand-strong\); border-color: rgba\(24, 24, 27, 0\.10\); box-shadow: 0 2px 10px rgba\(24, 24, 27, 0.3\); \}/,
  ".primary-button:hover { background: var(--brand-strong); border-color: var(--brand-strong); box-shadow: none; }"
);
css = css.replace(
  /\.secondary-button \{ border: 1px solid var\(--border-strong\); background: rgba\(24, 24, 27, 0\.04\); color: var\(--text-secondary\); box-shadow: none; \}/,
  ".secondary-button { border: 1px solid var(--border-strong); background: var(--bg-panel); color: var(--text-secondary); box-shadow: none; }"
);

css = css.replace(
  /\.metric-grid \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); border: 1px solid var\(--border\); border-radius: 10px; background: var\(--bg-panel\); box-shadow: none; \}/,
  ".metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--border); border-radius: 10px; background: var(--bg-panel); }"
);
css = css.replace(
  /\.panel \{ min-width: 0; border: 1px solid var\(--border\); border-radius: 10px; background: var\(--bg-panel\); box-shadow: none; \}/,
  ".panel { min-width: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-panel); }"
);

css = css.replace(
  /\.segmented-control button\.active \{\n  color: #ffffff;/,
  ".segmented-control button.active {\n  color: var(--text-primary);"
);
css = css.replace(
  /background: rgba\(118, 118, 128, 0\.2\);/,
  "background: var(--bg-raised);"
);
css = css.replace(
  /\.segmented-indicator \{\n  position: absolute;\n  inset: 0;\n  border-radius: 6px;\n  background: rgba\(24, 24, 27, 0\.06\);\n  box-shadow: none;/,
  `.segmented-indicator {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: var(--bg-panel);
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.08);`
);
css = css.replace(
  /\.segmented-indicator-brand \{\n  background: var\(--brand\);\n  box-shadow: 0 2px 10px rgba\(24, 24, 27, 0.4\); \}/,
  ".segmented-indicator-brand {\n  background: var(--bg-panel);\n  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.08);\n}"
);

css = css.replace(
  /\.content-area \{ max-width: 1480px; margin: 0 auto; padding: 36px 36px 64px; \}/,
  ".content-area { max-width: 1320px; margin: 0 auto; padding: 28px 28px 56px; }"
);
css = css.replace(
  /\.page-stack \{ display: flex; flex-direction: column; gap: 28px; \}/,
  ".page-stack { display: flex; flex-direction: column; gap: 22px; }"
);
css = css.replace(
  /\.page-stack > \* \{\n  animation: erp-fade-in \.15s var\(--ease-out\) both;\n\}/,
  ".page-stack > * { animation: none; }"
);

css = css.replace(
  /\.data-table th \{ border-bottom: 1px solid var\(--border\); background: var\(--bg-panel\); padding: 14px 22px; color: var\(--text-muted\); font-size: 11\.5px; font-weight: 600; letter-spacing: \.04em; line-height: 1\.45; text-align: left; text-transform: uppercase; white-space: nowrap; \}/,
  ".data-table th { border-bottom: 1px solid var(--border); background: var(--bg-raised); padding: 10px 16px; color: var(--text-muted); font-size: 11.5px; font-weight: 600; letter-spacing: .02em; line-height: 1.45; text-align: left; text-transform: none; white-space: nowrap; }"
);
css = css.replace(
  /\.data-table td \{ border-bottom: 1px solid var\(--border\); padding: 15px 22px; white-space: nowrap; vertical-align: middle; \}/,
  ".data-table td { border-bottom: 1px solid var(--border); padding: 11px 16px; white-space: nowrap; vertical-align: middle; }"
);
css = css.replace(/min-width: 760px/, "min-width: 640px");

css = css.replace(
  /\.command-dialog \{ width: min\(610px, calc\(100vw \/ var\(--ui-zoom\) - 30px\)\); overflow: hidden; overscroll-behavior: contain; border: 1px solid var\(--border-strong\); border-radius: 12px; background: rgba\(26, 27, 32, 0\.92\); box-shadow: var\(--shadow-popover\); animation: dialog-in \.18s var\(--ease-out\); \}/,
  ".command-dialog { width: min(610px, calc(100vw - 30px)); overflow: hidden; overscroll-behavior: contain; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--bg-panel); box-shadow: var(--shadow-popover); animation: dialog-in .18s var(--ease-out); }"
);
css = css.replace(/background: rgba\(26, 27, 32, 0\.92\);/g, "background: var(--bg-panel);");
css = css.replace(/background: rgba\(24, 25, 29, 0\.90\);/g, "background: var(--bg-panel);");

css = css.replace(
  /@media \(prefers-contrast: more\) \{\n  :root \{\n    --border: rgba\(24, 24, 27, 0\.10\);\n    --border-strong: rgba\(24, 24, 27, 0\.16\);\n    --border-subtle: rgba\(24, 24, 27, 0\.07\);\n    --text-muted: rgba\(235, 235, 245, 0\.72\);\n    --text-faint: rgba\(235, 235, 245, 0\.50\);\n  \}\n\}/,
  `@media (prefers-contrast: more) {
  :root {
    --border: rgba(24, 24, 27, 0.22);
    --border-strong: rgba(24, 24, 27, 0.34);
    --border-subtle: rgba(24, 24, 27, 0.16);
    --text-muted: #3f3f46;
    --text-faint: #52525b;
  }
}`
);

css = css.replace(
  /\.credential-panel \{ border-color: rgba\(24, 24, 27, 0.28\); background: linear-gradient\(180deg, rgba\(24, 24, 27, 0.06\), transparent 120px\); \}/,
  ".credential-panel { border-color: var(--border-strong); background: var(--bg-raised); }"
);

css = css.replace(/border-left: 3px solid/g, "border-left: 1px solid");

css += `

::selection { background: rgba(24, 24, 27, 0.14); color: var(--text-primary); }
input, textarea, select { caret-color: var(--text-primary); }
.metric-icon { background: var(--bg-raised); color: var(--text-secondary); }
.app-dialog, .command-dialog, .profile-menu, .profile-drawer {
  background: var(--bg-panel);
  box-shadow: var(--shadow-popover);
}
`;

fs.writeFileSync(path, css);
console.log("rewrote", path.pathname, "bytes", css.length);
