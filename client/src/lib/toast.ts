import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * Toast wrapper.
 *
 * Sonner is used directly all over the app, and three of its defaults do not
 * suit an interface that fires a toast from a button:
 *
 *   1. **No de-duplication.** Thirty-odd buttons are wired straight to
 *      `onClick={() => toast(...)}` with no pending guard, so clicking one
 *      three times in a second stacked three identical cards. Nothing collapsed
 *      them, because without an `id` every call is a new toast.
 *   2. **No stack limit.** With enough rapid clicks the stack grew until it ran
 *      up the side of the window.
 *   3. **Silence for repeats is not the same as silence for everything.** Two
 *      genuinely different failures should both be visible, so de-duplication is
 *      per message, not global.
 *
 * Passing an `id` makes Sonner treat a repeat call as an update of the toast
 * already on screen rather than a new one, which is exactly the wanted
 * behaviour: the message is refreshed, its timer restarts, and the stack stays
 * one card tall.
 *
 * The id is derived from the message text rather than passed by hand. Deriving
 * it means the existing call sites — `toast("Filters opened")` and friends —
 * gain the protection without being rewritten, and two different messages still
 * produce two different ids, so neither is swallowed.
 */

/** How many toasts may be on screen at once. */
const MAX_VISIBLE = 4;

type ToastArgs = [message: unknown, data?: ExternalToast];

/**
 * A stable id for a message.
 *
 * The same text must always produce the same id, in this session only — a toast
 * id that persisted between page loads would let a stale card linger. The
 * counter plus the text is enough: text alone would collide across two
 * different messages that happen to share a body but differ in `description`.
 */
const ids = new Map<string, string>();
let counter = 0;

function idFor(message: unknown, data?: ExternalToast): string {
  const key =
    typeof message === "string"
      ? `${message}|${data?.description ?? ""}`
      : String(message);
  const existing = ids.get(key);
  if (existing) return existing;
  counter += 1;
  const id = `erp-toast-${counter}`;
  ids.set(key, id);
  return id;
}

function fire(method: "success" | "error" | "warning" | "info", args: ToastArgs) {
  const [message, data] = args;
  const options: ExternalToast = {
    id: idFor(message, data),
    // A card that cannot be dismissed is worse than one that lingers, but an
    // error carrying instructions needs longer than a confirmation.
    duration:
      method === "error" ? 6500 : typeof data?.duration === "number" ? data.duration : 4200,
    ...data,
  };
  return method === "success"
    ? sonnerToast.success(message as string, options)
    : method === "error"
      ? sonnerToast.error(message as string, options)
      : method === "warning"
        ? sonnerToast.warning(message as string, options)
        : sonnerToast.info(message as string, options);
}

/**
 * Notify.
 *
 * Typed variants mirror Sonner's, with de-duplication applied. Untyped `toast()`
 * is kept for informational messages ("Filters opened"), which is why the
 * stylesheet gives them a neutral accent rather than a success one.
 */
export const toast = Object.assign(
  (message: unknown, data?: ExternalToast) =>
    sonnerToast(message as string, {
      id: idFor(message, data),
      duration: 3200,
      ...data,
    }),
  {
    success: (...args: ToastArgs) => fire("success", args),
    error: (...args: ToastArgs) => fire("error", args),
    warning: (...args: ToastArgs) => fire("warning", args),
    info: (...args: ToastArgs) => fire("info", args),
    loading: (message: unknown, data?: ExternalToast) =>
      sonnerToast.loading(message as string, {
        id: idFor(message, data),
        ...data,
      }),
    dismiss: (toastId?: number | string) => sonnerToast.dismiss(toastId),
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
  }
);

export { MAX_VISIBLE };