import { useEffect } from "react";
import Lenis from "lenis";

/**
 * The live instance, so imperative scrolls (navigating between views) go
 * through Lenis instead of fighting it with a native scrollTo.
 */
let instance: Lenis | null = null;

/**
 * Count of overlays asking for the page to hold still.
 *
 * A count rather than a boolean because two overlays can be open at once, and
 * whichever closes second must not unlock the page out from under the one still
 * on screen.
 */
let scrollLocks = 0;

/**
 * Freeze the scrolling page while an overlay is open.
 *
 * Lenis keeps its own animated position and drives the wheel itself, so telling
 * it to stop is the only thing that actually holds the page: setting
 * `overflow: hidden` on its wrapper is ignored while it is running. The wrapper
 * is locked too, for the branch where Lenis is never constructed at all —
 * reduced motion, or a touch device, both of which return early below.
 *
 * The scroll position is left exactly where it was. Resetting it is what makes
 * an overlay feel like it threw you to the top of the page.
 */
export function setPageScrollLocked(locked: boolean): void {
  /*
   * The count alone decides the state, so there is nothing to bail out of here.
   * An earlier version returned early while any lock was held — meant to stop a
   * second overlay unlocking the page on its way out — but it bailed out of the
   * *first* lock too, before the class was ever applied. The page stayed
   * scrollable behind the panel for the whole time this existed.
   */
  scrollLocks = Math.max(0, scrollLocks + (locked ? 1 : -1));
  const held = scrollLocks > 0;

  if (instance) {
    if (held) instance.stop();
    else instance.start();
  }
  document.documentElement.classList.toggle("page-scroll-locked", held);
}

export function smoothScrollTo(target: number): void {
  if (instance) instance.scrollTo(target, { immediate: true });
}

/**
 * Hold the page still for as long as an overlay is mounted.
 *
 * Modals used to rely on their scrim alone, which dims the page but leaves the
 * wheel pointed at `.main-area`; scrolling a short dialog therefore moved the
 * dashboard behind it. The lock is reference-counted, so nested overlays (a
 * dialog over a drawer) hand the page back only when the last one closes.
 */
export function usePageScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    setPageScrollLocked(true);
    return () => setPageScrollLocked(false);
  }, [active]);
}


export default function SmoothScroll({
  scrollRef,
  contentRef,
  children,
}: {
  /** The element that actually scrolls — `.main-area`. */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** The element whose height defines how far you can scroll — `.content-area`. */
  contentRef?: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (reduceMotion || coarsePointer) return;

    const wrapper = scrollRef.current;
    const content = contentRef?.current;
    if (!wrapper) return;

    const lenis = new Lenis({
      // This app scrolls `.main-area`, not the window, so Lenis has to drive
      // that wrapper rather than the default `window`.
      wrapper,
      // Tell Lenis what to *measure*. Left at the default
      // (`document.documentElement`) it watches an element whose height never
      // changes, while the wrapper's own box is a fixed 100dvh — so neither of
      // the ResizeObservers Lenis sets up would ever fire.
      content: content ?? wrapper,
      duration: 0.65,
      easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      // Tables scroll horizontally inside the page; without this Lenis
      // swallows wheel events over them instead of letting them pan.
      allowNestedScroll: true,
      syncTouch: false,
    });
    instance = lenis;
    // An overlay may already be open — the dashboard can swap views underneath
    // one. A fresh instance starts stopped or the page slides again.
    if (scrollLocks > 0) lenis.stop();

    let lastHeight = 0;

    /** Refresh Lenis's cached scroll range if the content grew or shrank. */
    const syncHeight = () => {
      const height = wrapper.scrollHeight;
      if (height === lastHeight) return;
      lastHeight = height;
      lenis.resize();
    };

    // Immediate on any change to the scrolling content (a table paging from 20
    // rows to 5, a skeleton resolving, a chart finishing its layout).
    const observer = new ResizeObserver(syncHeight);
    observer.observe(content ?? wrapper);

    // Lenis's own resize handler is debounced by 250ms and only watches the
    // elements it was constructed with. The dashboard swaps whole views, so
    // this safety net re-measures off the hot path — cheap, and it means a
    // stale `limit` can never strand the user short of the bottom.
    const reconcile = window.setInterval(syncHeight, 400);

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(reconcile);
      observer.disconnect();
      lenis.destroy();
      instance = null;
    };
  }, [scrollRef, contentRef]);

  return <>{children}</>;
}