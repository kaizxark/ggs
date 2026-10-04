import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination for a list the *server* paged.
 *
 * The existing `usePagination` slices an array the browser already holds, which
 * is right for a view that fetched every row. The student directory cannot work
 * that way: it asks for one page at a time so the browser never holds the whole
 * roll call, so its page count, total and bounds come from the response rather
 * than from `rows.length`.
 *
 * The two are deliberately separate types rather than one component with a
 * `serverTotal` prop, because mixing them invites the mistake this replaces —
 * computing a page count from the rows on screen and then asking the server for
 * a page that does not exist.
 */
export interface ServerPagerProps {
  page: number;
  pageCount: number;
  /** Total matching records, from the server. */
  total: number;
  /** How many are on the current page. */
  showing: number;
  /** The noun in "20 students", for the summary line. */
  noun: string;
  onChange: (page: number) => void;
  disabled?: boolean;
  /**
   * True when the server stopped scanning at its ceiling, so the total is a
   * lower bound rather than a count. Surfaced rather than hidden, because a
   * silently truncated directory would read as "these are all the pupils".
   */
  truncated?: boolean;
}

export function ServerPager({
  page,
  pageCount,
  total,
  showing,
  noun,
  onChange,
  disabled = false,
  truncated = false,
}: ServerPagerProps) {
  const from = total === 0 ? 0 : (page - 1) * showing + 1;
  // `from + showing - 1` overshoots on the last page, which is shorter.
  const to = Math.min(total, (page - 1) * showing + showing);

  const pages = windowed(page, pageCount);

  return (
    <div className="table-footer">
      <span className="table-footer-count">
        {truncated ? (
          <>Showing {from.toLocaleString()}–{to.toLocaleString()} of at least {total.toLocaleString()} {noun}</>
        ) : total === 0 ? (
          <>No {noun} match these filters</>
        ) : (
          <>
            Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
          </>
        )}
      </span>

      {pageCount > 1 && (
        <div className="pager" role="navigation" aria-label={`${noun} pages`}>
          <button
            className="pager-button"
            onClick={() => onChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>

          {pages.map((entry, index) =>
            entry === -1 ? (
              <span key={`gap-${index}`} className="pager-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={entry}
                className={`pager-button${entry === page ? " active" : ""}`}
                onClick={() => onChange(entry)}
                disabled={disabled}
                aria-current={entry === page ? "page" : undefined}
                aria-label={`Page ${entry}`}
              >
                {entry}
              </button>
            ),
          )}

          <button
            className="pager-button"
            onClick={() => onChange(page + 1)}
            disabled={disabled || page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Page numbers to render, with -1 standing in for an elided gap.
 *
 * Always shows the first and last page plus a window around the current one, so
 * the control stays a fixed width whether the school has 3 pages or 3,000.
 */
function windowed(page: number, pageCount: number): number[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const out: number[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);

  if (from > 2) out.push(-1);
  for (let n = from; n <= to; n++) out.push(n);
  if (to < pageCount - 1) out.push(-1);
  out.push(pageCount);

  return out;
}