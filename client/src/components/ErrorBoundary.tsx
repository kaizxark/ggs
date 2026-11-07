import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Crash screen.
 *
 * This used to be styled with shadcn theme tokens (`bg-background`,
 * `text-destructive`, `bg-muted`) that are not defined anywhere in this
 * stylesheet, so a crash rendered as unstyled text on a white page — the worst
 * possible moment to discover the theme variables do not exist. It now uses the
 * same palette as the rest of the app.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen items-center justify-center p-8"
          style={{ background: "var(--bg-page)", fontFamily: "system-ui, sans-serif" }}
        >
          <div className="w-full max-w-2xl">
            <div
              className="flex flex-col items-center rounded-2xl border p-8 text-center"
              style={{ borderColor: "var(--border-strong)", background: "var(--bg-panel)" }}
            >
              <AlertTriangle size={44} className="mb-5" style={{ color: "var(--danger)" }} />

              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Something went wrong
              </h2>
              <p className="mt-2 mb-6 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                The dashboard hit an unexpected error and stopped. Reloading
                usually clears it.
              </p>

              {this.state.error?.message && (
                <div
                  className="mb-6 w-full overflow-auto rounded-lg border p-4 text-left"
                  style={{ borderColor: "var(--danger-border)", background: "var(--danger-soft-2)" }}
                >
                  <pre
                    className="text-[12.5px] whitespace-break-spaces"
                    style={{ color: "var(--danger)" }}
                  >
                    {this.state.error.message}
                  </pre>
                </div>
              )}

              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition"
                )}
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                <RotateCcw size={16} />
                Reload dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;