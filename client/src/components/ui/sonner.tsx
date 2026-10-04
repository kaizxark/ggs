import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { MAX_VISIBLE } from "@/lib/toast";

/**
 * Toast host.
 *
 * ## Why this no longer reads the theme from `next-themes`
 *
 * It used to, but the app has its own `ThemeContext` and never mounts
 * `next-themes` at all. `useTheme` from that package falls back to `"system"`
 * when it finds no provider, so every toast was rendered with Sonner's *system*
 * styling rather than the theme actually in use — on a dark app that meant the
 * near-black, faintly-tinted toasts that looked like tinted glass. Reading the
 * real context is what makes a toast match the screen it appears on.
 *
 * The colours themselves live in `index.css` under "Toasts". This component only
 * supplies the variables' inputs and the behaviour; keeping the values in one
 * stylesheet means a toast cannot drift from the rest of the palette.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster"
      position="bottom-right"
      // Long enough to read a sentence, short enough that a burst of them does
      // not build a wall. Errors stay longer because they carry instructions.
      duration={4200}
      // A stack that grows without bound runs up the side of the window. Four is
      // enough to read without the oldest scrolling off before it is seen.
      visibleToasts={MAX_VISIBLE}
      toastOptions={{ classNames: { toast: "erp-toast" } }}
      {...props}
    />
  );
};

export { Toaster };