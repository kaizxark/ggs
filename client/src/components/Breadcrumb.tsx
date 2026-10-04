import { ChevronRight } from "lucide-react";

/**
 * Screen path.
 *
 * `parent` is the school root and is a real button whenever a way back is
 * supplied — a span that looks clickable but does nothing is worse than no
 * breadcrumb at all.
 */
export function Breadcrumb({
  parent,
  current,
  onParentClick,
}: {
  parent: string;
  current: string;
  onParentClick?: () => void;
}) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {onParentClick ? (
        <button type="button" className="breadcrumb-root" onClick={onParentClick}>
          {parent}
        </button>
      ) : (
        <span className="breadcrumb-root">{parent}</span>
      )}
      <ChevronRight size={13} className="breadcrumb-sep" />
      <span className="breadcrumb-current" aria-current="page">{current}</span>
    </nav>
  );
}