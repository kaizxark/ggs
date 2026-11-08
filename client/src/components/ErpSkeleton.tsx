/**
 * Loading placeholders for the ERP dashboard.
 *
 * Every live view resolves asynchronously, so each one needs a placeholder that
 * matches the shape of the content it will become. These components keep the
 * layout stable while data is in flight — the real content replaces them in
 * place, with no reflow and no jump.
 *
 * ## The three things that make a skeleton feel cheap, and what is done about
 * them here
 *
 * 1. **The wrong colour.** A skeleton painted in a *text* grey reads as solid
 *    content, so the eye tries to parse it and fails. These are painted in a
 *    *surface* tint one step above the panel they sit on — visible as "something
 *    is here", never mistaken for something to read.
 *
 * 2. **An eased infinite loop.** The sweep is `linear`. An eased curve looks
 *    correct once, then restarts from zero velocity every cycle, and the
 *    stutter on repeat is the single clearest tell that a loader is fake.
 *
 * 3. **A placeholder that is not the shape of the thing.** A bar chart skeleton
 *    over an area chart makes the layout jump when the real chart draws,
 *    because the two have different internal geometry. `SkeletonChart` takes a
 *    `variant` and draws the silhouette that matches.
 */

import type { CSSProperties, ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  /** Width for text placeholders, e.g. "60%" or a px string. */
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Wraps a group of placeholders and announces it once.
 *
 * Every placeholder inside is `aria-hidden`, so without this a screen reader
 * walks the table skeleton cell by cell and reads a column of empty boxes. One
 * status region gives one clear message instead.
 */
export function SkeletonRegion({
  label = "Loading",
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("skeleton-region", className)} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonText({ width = "100%", height, className, style }: SkeletonProps) {
  return (
    <span
      className={cx("erp-skeleton erp-skeleton-text", className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonBlock({ className, style }: SkeletonProps) {
  return <div className={cx("erp-skeleton", className)} style={style} aria-hidden="true" />;
}

export function SkeletonCircle({ size = 32, className }: SkeletonProps & { size?: number }) {
  return (
    <span
      className={cx("erp-skeleton erp-skeleton-circle", className)}
      style={{ width: size, height: size, flex: "0 0 auto" }}
      aria-hidden="true"
    />
  );
}

/**
 * Mirrors `.metric-block`: label + icon, then value + comparison beside the
 * sparkline. The old version added a full-width 3px bar that the real card
 * never draws, so the panel got shorter the moment data arrived.
 */
export function SkeletonMetric() {
  return (
    <div className="metric-block" aria-hidden="true">
      <div className="flex items-center justify-between">
        <SkeletonText width="52%" />
        <SkeletonCircle size={22} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SkeletonText width="58%" height={24} />
          <SkeletonText width="44%" style={{ marginTop: 8 }} />
        </div>
        <span
          className="erp-skeleton-spark"
          style={{ width: 84, height: 44 }}
        >
          {/* A line, not a solid slab: the real card draws a sparkline here,
              and a filled rectangle read as a missing image. */}
          <svg
            viewBox="0 0 100 44"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="erp-skeleton-spark-svg"
          >
            <path
              className="erp-skeleton-spark-area"
              d="M0,34 L20,26 L40,30 L60,18 L80,22 L100,12 L100,44 L0,44 Z"
            />
            <path
              className="erp-skeleton-spark-line"
              d="M0,34 L20,26 L40,30 L60,18 L80,22 L100,12"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}

/**
 * Mirrors a `.metric-grid` of n blocks.
 *
 * `three` matches the four-up grid's span behaviour on the views that use a
 * three-column metric row, so the placeholder grid has the same shape as the
 * one that replaces it.
 */
export function SkeletonMetrics({ count = 4, three = false }: { count?: number; three?: boolean }) {
  return (
    <div className={`metric-grid${three ? " three" : ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonMetric key={i} />
      ))}
    </div>
  );
}

/**
 * Mirrors a `.data-table` body.
 *
 * `columns` sets how many cells each row has so the column rhythm of the real
 * table is preserved. Widths vary by row and column on a fixed pattern — the
 * variation is what stops it looking like a barcode, and using an index rather
 * than a random number keeps the server and client markup identical.
 */
export function SkeletonTableRows({
  rows = 6,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden="true">
          {Array.from({ length: columns }, (_, c) => (
            <td key={c}>
              {c === 0 ? (
                <span className="erp-skeleton-row">
                  <SkeletonCircle size={26} />
                  <span className="erp-skeleton-stack" style={{ flex: 1 }}>
                    <SkeletonText width={`${58 + ((r + c) % 3) * 12}%`} />
                    <SkeletonText width="38%" />
                  </span>
                </span>
              ) : (
                <SkeletonText
                  width={`${34 + ((r * 3 + c * 7) % 5) * 9}%`}
                />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A table shell: header row plus skeleton body, inside `.table-scroll`. */
export function SkeletonTable({
  rows = 6,
  columns = 6,
  headers,
  label,
}: {
  rows?: number;
  columns?: number;
  headers?: string[];
  label?: string;
}) {
  return (
    <SkeletonRegion label={label ?? "Loading table"} className="table-scroll">
      <table className="data-table">
        {headers && (
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          <SkeletonTableRows rows={rows} columns={columns} />
        </tbody>
      </table>
    </SkeletonRegion>
  );
}

/** Mirrors a `.panel` with a header and a body of record rows. */
export function SkeletonPanel({
  title,
  bodyHeight = 160,
  rows,
  className,
}: {
  title?: boolean;
  bodyHeight?: number;
  rows?: number;
  className?: string;
}) {
  const rowCount = rows ?? Math.max(3, Math.round(bodyHeight / 58));
  return (
    <section className={cx("panel", className)} aria-hidden="true">
      {title !== false && (
        <div className="panel-header">
          <div>
            <SkeletonText width="34%" />
            <SkeletonText width="52%" height={15} style={{ marginTop: 8 }} />
          </div>
          <SkeletonText width={64} />
        </div>
      )}
      {/* Rows, not one solid slab. A single filled rectangle the size of the
          panel reads as a failed image; rows read as "records are arriving".
          `SkeletonList` brings its own horizontal padding. */}
      <div style={{ paddingTop: 4, minHeight: bodyHeight }}>
        <SkeletonList rows={rowCount} avatar={false} />
      </div>
    </section>
  );
}

/**
 * Mirrors a `.health-metric`: a label, a progress ring and a bar.
 *
 * The ring is reserved as a circle rather than a bar because that is what the
 * real tile draws — a bar-shaped hole would be filled by a round ring and the
 * panel would grow sideways on arrival.
 */
export function SkeletonHealthMetric() {
  return (
    <div className="health-metric" aria-hidden="true">
      <div className="flex items-center justify-between">
        <SkeletonText width="52%" />
        <SkeletonText width={34} height={10} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <SkeletonCircle size={44} />
        <div className="min-w-0 flex-1">
          <SkeletonBlock style={{ height: 6, borderRadius: 999 }} />
          <SkeletonText width="62%" height={10} style={{ marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
}

/** Mirrors a `.health-grid` of n tiles. */
export function SkeletonHealthGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="health-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonHealthMetric key={i} />
      ))}
    </div>
  );
}

/** Mirrors the `.today-timeline` operating-day list. */
export function SkeletonTimeline({ rows = 4 }: { rows?: number }) {
  return (
    <div className="today-timeline" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="erp-skeleton-row" style={{ padding: "13px 0" }}>
          <SkeletonText width={44} height={10} />
          <SkeletonCircle size={30} />
          <span className="erp-skeleton-stack" style={{ flex: 1 }}>
            <SkeletonText width={`${46 + (i % 3) * 14}%`} />
            <SkeletonText width={`${28 + (i % 4) * 10}%`} />
          </span>
          <SkeletonText width={15} height={10} />
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors the sidebar navigation rail.
 *
 * This exists because the rail's *contents* depend on the signed-in user's
 * role, and the role resolves a moment after the page paints. Without it the
 * rail rendered its narrow fallback set first and then grew to the real one,
 * so on every load the user watched fifteen buttons arrive in two waves.
 *
 * The row count deliberately matches the fullest role. A staff user then sees a
 * few placeholders become real buttons, which is the ordinary loading pattern;
 * what they no longer see is the rail re-shuffling itself.
 */
export function SkeletonNav({ groups = [5, 4, 3] }: { groups?: number[] }) {
  return (
    <div className="skeleton-region skeleton-nav" role="status" aria-busy="true">
      <span className="sr-only">Loading navigation</span>
      {groups.map((count, groupIndex) => (
        <div className="nav-group" key={groupIndex} aria-hidden="true">
          <p className="nav-group-label">
            <SkeletonText width={groupIndex === 2 ? 46 : 52} height={9} />
          </p>
          {Array.from({ length: count }, (_, i) => (
            <div className="nav-item" key={i}>
              <SkeletonCircle size={17} />
              <span className="nav-label">
                <SkeletonText width={`${58 + ((i * 5 + groupIndex * 7) % 4) * 9}%`} height={11} />
              </span>
              {i === 0 && groupIndex === 0 ? (
                <span className="nav-count">
                  <SkeletonInline width={22} height={9} />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Mirrors a simple vertical list of records (messages, announcements, …). */
export function SkeletonList({
  rows = 4,
  avatar = true,
  action = true,
}: {
  rows?: number;
  avatar?: boolean;
  /** The trailing control — a timestamp, a button, a chevron. */
  action?: boolean;
}) {
  return (
    <div className="px-5 pb-5" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="erp-skeleton-row"
          style={{
            padding: "13px 0",
            borderTop: i === 0 ? "none" : "1px solid var(--border)",
          }}
        >
          {avatar && <SkeletonCircle size={30} />}
          <span className="erp-skeleton-stack" style={{ flex: 1 }}>
            <SkeletonText width={`${52 + (i % 3) * 14}%`} />
            <SkeletonText width={`${30 + (i % 4) * 9}%`} />
          </span>
          {action && <SkeletonText width={44} />}
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors a chart area so the panel doesn't collapse before data arrives.
 *
 * `variant` must match the chart being replaced — that is the whole point. An
 * area chart and a bar chart have different internal geometry, and the
 * placeholder has to reserve the same room the real one will use.
 */
export function SkeletonChart({
  height = 250,
  variant = "bar",
  legend = 0,
}: {
  height?: number;
  variant?: "area" | "bar" | "pie";
  /** Number of legend swatches to reserve beside the plot. */
  legend?: number;
}) {
  return (
    <div className="skeleton-chart" style={{ height }} aria-hidden="true">
      {variant === "pie" ? (
        <div className="skeleton-pie">
          <span className="erp-skeleton erp-skeleton-ring" />
          <span className="skeleton-legend">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonText key={i} width={`${58 - i * 6}%`} height={10} />
            ))}
          </span>
        </div>
      ) : variant === "area" ? (
        <svg
          className="skeleton-plot"
          viewBox="0 0 320 120"
          preserveAspectRatio="none"
          focusable="false"
        >
          {/* Gridlines and a y-axis, so the real chart's axes land in place. */}
          {[20, 50, 80, 110].map((y) => (
            <line
              key={y}
              x1="0"
              x2="320"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            className="erp-skeleton-svg"
            d="M0,86 L40,70 L80,78 L120,54 L160,62 L200,40 L240,48 L280,30 L320,38 L320,120 L0,120 Z"
          />
          <path
            className="erp-skeleton erp-skeleton-svg-line"
            d="M0,86 L40,70 L80,78 L120,54 L160,62 L200,40 L240,48 L280,30 L320,38"
          />
        </svg>
      ) : (
        <div className="skeleton-bars">
          {/* Deterministic heights read as a chart silhouette without the jitter
              a random set would add on every re-render. */}
          {[46, 62, 38, 74, 55, 81, 43, 68, 58, 77, 51, 69].map((h, i) => (
            <span
              key={i}
              className="erp-skeleton erp-skeleton-bar"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}

      {legend > 0 && (
        <div className="skeleton-legend-row">
          {Array.from({ length: legend }, (_, i) => (
            <span key={i} className="skeleton-legend-item" aria-hidden="true">
              <span className="erp-skeleton erp-skeleton-dot" />
              <SkeletonText width={46} height={9} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Small inline placeholder for a number or label inside an otherwise
 * populated component (e.g. a sidebar count).
 */
export function SkeletonInline({ width = 22, height = 10 }: SkeletonProps) {
  return (
    <span
      className="erp-skeleton erp-skeleton-text"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}