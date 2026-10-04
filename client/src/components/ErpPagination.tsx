import { useEffect, useMemo, useState } from "react";

/** Records shown per page, per the product requirement. */
export const PAGE_SIZE = 20;

export interface Pagination<T> {
  /** The rows for the current page. */
  pageRows: T[];
  /** 1-based current page. */
  page: number;
  /** Total number of pages (always >= 1). */
  pageCount: number;
  /** Total records across all pages. */
  total: number;
  /** First record index on this page (1-based), for "Showing 1–20 of N". */
  from: number;
  /** Last record index on this page (1-based). */
  to: number;
  goTo: (page: number) => void;
  next: () => void;
  prev: () => void;
  canNext: boolean;
  canPrev: boolean;
  /** True when everything fits on one page — lets callers hide the pager. */
  isSinglePage: boolean;
  /** Visible page numbers, windowed around the current page. */
  pages: number[];
}

/**
 * Client-side pagination for an in-memory record list.
 *
 * The dashboard already holds every row for a view in memory (they were
 * fetched together), so paging happens here rather than in the query. The
 * page resets whenever the underlying list identity changes — switching a
 * filter or a view must not strand the user on page 4 of a 1-page list.
 */
export function usePagination<T>(rows: T[], pageSize = PAGE_SIZE): Pagination<T> {
  const [page, setPage] = useState(1);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // clamp if the list shrinks (e.g. a filter narrows the results)
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const pageRows = useMemo(
    () => rows.slice(start, start + pageSize),
    [rows, start, pageSize]
  );

  const goTo = (next: number) => {
    setPage(Math.min(Math.max(1, next), pageCount));
  };

  const pages = useMemo(() => {
    // Window the numbers so a long list doesn't render 100 buttons.
    const maxButtons = 5;
    if (pageCount <= maxButtons) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    const half = Math.floor(maxButtons / 2);
    let startPage = Math.max(1, page - half);
    const endPage = Math.min(pageCount, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  }, [page, pageCount]);

  return {
    pageRows,
    page,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    goTo,
    next: () => goTo(page + 1),
    prev: () => goTo(page - 1),
    canNext: page < pageCount,
    canPrev: page > 1,
    isSinglePage: pageCount <= 1,
    pages,
  };
}

interface PagerProps {
  pagination: Pagination<unknown>;
  /** Noun for the footer, e.g. "students" -> "of 100 students". */
  noun: string;
  /**
   * `table` sits flush inside a table panel (bordered top, indented);
   * `list` is a standalone bar under a list container.
   */
  variant?: "table" | "list";
}

/**
 * The single pager used everywhere records are listed.
 *
 * Both variants render identical controls — same page numbers, same
 * ellipsis window, same prev/next — so navigating between any two views
 * never changes how pagination behaves. Only the surrounding chrome
 * differs, which is what `variant` selects.
 */
export function Pager({ pagination, noun, variant = "table" }: PagerProps) {
  const {
    page,
    pageCount,
    from,
    to,
    total,
    goTo,
    next,
    prev,
    canNext,
    canPrev,
    isSinglePage,
    pages,
  } = pagination;

  if (total === 0) return null;

  return (
    <div className={`erp-pager ${variant}`}>
      <span className="erp-pager-count">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>{" "}
        {noun}
      </span>
      {!isSinglePage && (
        <div className="pagination">
          <button onClick={prev} disabled={!canPrev} aria-label="Previous page">
            ←
          </button>
          {pages[0] > 1 && (
            <>
              <button onClick={() => goTo(1)}>1</button>
              {pages[0] > 2 && <span className="pagination-gap">…</span>}
            </>
          )}
          {pages.map((n) => (
            <button
              key={n}
              className={n === page ? "current" : ""}
              onClick={() => goTo(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </button>
          ))}
          {pages[pages.length - 1] < pageCount && (
            <>
              {pages[pages.length - 1] < pageCount - 1 && (
                <span className="pagination-gap">…</span>
              )}
              <button onClick={() => goTo(pageCount)}>{pageCount}</button>
            </>
          )}
          <button onClick={next} disabled={!canNext} aria-label="Next page">
            →
          </button>
        </div>
      )}
    </div>
  );
}
