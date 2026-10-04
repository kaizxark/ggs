import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy } from "react";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useSession } from "./lib/supabase";

/*
 * The pages are loaded on demand rather than imported up front.

 * The dashboard is where the charting libraries live - recharts and the lodash
 * and d3 packages it pulls in come to about 870 KB of the bundle, nearly twice
 * the size of everything else combined. None of it is used by the sign-in
 * screen, which is the first thing an unauthenticated visitor loads and the one
 * that has to feel instant. Loading it on demand means signing in fetches it,
 * and the login page does not pay for a chart it will never draw.
 *
 * The dashboard itself is one 290 KB module, so there is nothing to gain by
 * splitting its internals further - it is needed whole the moment it renders.
 */
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

/*
 * The fallback is the same spinner the auth check already shows, so a route
 * change does not flash a different loading state than the one that preceded
 * it. It is deliberately the full-viewport AuthSplash rather than a spinner
 * inside the page frame: the page frame is part of the chunk being loaded.
 */
function AuthSplash() {
  return (
    <div
      className="min-h-screen bg-[#0b0c10] flex items-center justify-center"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3fb8a2]/30 border-t-[#3fb8a2]" />
    </div>
  );
}

function GuardedDashboard() {
  const { isAuthenticated, loading } = useSession();
  if (loading) return <AuthSplash />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Suspense fallback={<AuthSplash />}><Dashboard /></Suspense>;
}

function LoginGate() {
  const { isAuthenticated, loading } = useSession();
  if (loading) return <AuthSplash />;
  if (isAuthenticated) return <Redirect to="/dashboard" />;
  return <Suspense fallback={<AuthSplash />}><Login /></Suspense>;
}

function Router() {
  return (
    <Suspense fallback={<AuthSplash />}>
      <Switch>
        {/*
          Deliberately outside LoginGate. The recovery link signs the person in on
          arrival, so a gate that redirects any authenticated visitor to the
          dashboard would send them there before they could choose a password —
          leaving them signed in and with the old password still in force.
        */}
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/login" component={LoginGate} />
        <Route path="/" component={GuardedDashboard} />
        <Route path="/dashboard" component={GuardedDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
