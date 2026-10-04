import { useEffect } from "react";
import Lenis from "lenis";

/**
 * The live instance, so imperative scrolls (navigating between views) go
 * through Lenis instead of fighting it with a native scrollTo.
 */
let instance: Lenis | null = null;

export function smoothScrollTo(target: number): void {
  if (instance) instance.scrollTo(target, { immediate: true });
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
      duration: 1.05,
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