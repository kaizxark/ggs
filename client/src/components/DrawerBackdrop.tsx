import { useEffect } from "react";

import { setPageScrollLocked } from "@/components/SmoothScroll";

/**
 * Freeze the page behind an overlay, and put a blurred sheet over it.
 *
 * ## Why this is not just `body { overflow: hidden }`
 *
 * It looks like it should be, and it silently does nothing here. This app does
 * not scroll the window — `.main-area` is its own scroll container and Lenis
 * drives that element. Locking the body leaves the one thing that actually
 * moves free to keep moving, which is what let the roll call slide around
 * behind the panel while you read a pupil's record.
 *
 * Two locks are needed because there are two scroll paths, and only one of them
 * exists at a time:
 *
 *   * **Lenis**, when the user has not asked for reduced motion and is not on a
 *     touch device. It hijacks the wheel and keeps its own animated position, so
 *     `overflow: hidden` on its wrapper is ignored — it has to be told to stop.
 *   * **The wrapper's own overflow**, in every other case, including the branch
 *     where Lenis is never constructed at all.
 *
 * Both are applied unconditionally. Doing the cheap one when it is not needed
 * costs nothing; doing neither is what produced the bug.
 *
 * ## Why the lock is reference-counted
 *
 * Two panels can be open in the same commit — a pupil's drawer over a dialog,
 * say. Unlocking when the first of them closes would hand the page back while
 * the second is still up. Each caller holds a count for as long as it is open.
 */
let locks = 0;

/** Elements to hand focus back to when the last overlay closes. */
const returnFocusTo: Array<HTMLElement | null> = [];

export function DrawerBackdrop({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    locks += 1;
    returnFocusTo.push(document.activeElement as HTMLElement | null);

    setPageScrollLocked(true);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      locks -= 1;
      if (locks === 0) {
        setPageScrollLocked(false);
        returnFocusTo.pop();
        // Returning focus is what makes Escape feel like it closed something
        // rather than just teleporting the caret to the top of the document.
        returnFocusTo[returnFocusTo.length - 1]?.focus?.();
        returnFocusTo.length = 0;
      }
    };
  }, [onClose]);

  return (
    /*
     * A real element rather than a `::before` on the panel: it needs to sit
     * below the panel in the stacking order and above everything else, and a
     * pseudo-element would be trapped inside the panel's own `isolation: isolate`
     * backdrop root.
     */
    <div className="drawer-backdrop" onMouseDown={onClose} aria-hidden="true" />
  );
}