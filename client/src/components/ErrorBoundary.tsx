import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
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
 * Catches runtime crashes and stale-chunk dynamic import failures gracefully.
 * When a new deployment occurs, the browser tab may try to fetch a chunk hash
 * that was replaced on the server. In that case, this boundary automatically
 * triggers a page refresh to load the latest deployment bundle seamlessly.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const msg = error.message || "";
    const isChunkError =
      /dynamically imported module/i.test(msg) ||
      /failed to fetch/i.test(msg) ||
      /importing a module script failed/i.test(msg) ||
      /error loading dynamically imported module/i.test(msg);

    if (isChunkError && typeof window !== "undefined") {
      const key = "error_boundary_chunk_reload";
      const last = window.sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - Number(last) > 8000) {
        window.sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "";
      const isChunkError =
        /dynamically imported module/i.test(msg) ||
        /failed to fetch/i.test(msg) ||
        /importing a module script failed/i.test(msg);

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
                {isChunkError ? "New version deployed" : "Something went wrong"}
              </h2>
              <p className="mt-2 mb-6 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                {isChunkError
                  ? "A new update to Global Kids School ERP was deployed. Reloading the page will load the latest version."
                  : "The dashboard hit an unexpected error and stopped. Reloading usually clears it."}
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
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.removeItem("error_boundary_chunk_reload");
                    window.sessionStorage.removeItem("page-has-been-force-refreshed");
                    window.location.reload();
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-5 py-2.5 font-semibold transition"
                )}
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                {isChunkError ? <RefreshCw size={16} /> : <RotateCcw size={16} />}
                {isChunkError ? "Update & Reload" : "Reload dashboard"}
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
