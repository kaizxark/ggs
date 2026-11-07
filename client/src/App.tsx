import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useSession } from "./lib/supabase";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

function AuthSplash() {
  return (
    <div
      className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div
        role="status"
        aria-label="Loading"
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)]/30 border-t-[var(--brand)] [animation-duration:0.75s]"
      />
    </div>
  );
}

function GuardedDashboard() {
  const { isAuthenticated, loading } = useSession();
  if (loading) return <AuthSplash />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <Suspense fallback={<AuthSplash />}>
      <Dashboard />
    </Suspense>
  );
}

function LoginGate() {
  const { isAuthenticated, loading } = useSession();
  if (loading) return <AuthSplash />;
  if (isAuthenticated) return <Redirect to="/dashboard" />;
  return (
    <Suspense fallback={<AuthSplash />}>
      <Login />
    </Suspense>
  );
}

function ResetPasswordRoute() {
  return (
    <Suspense fallback={<AuthSplash />}>
      <ResetPassword />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      {/*
        Deliberately outside LoginGate. The recovery link signs the person in on
        arrival, so a gate that redirects any authenticated visitor to the
        dashboard would send them there before they could choose a password —
        leaving them signed in and with the old password still in force.
      */}
      <Route path="/reset-password" component={ResetPasswordRoute} />
      <Route path="/login" component={LoginGate} />
      <Route path="/" component={GuardedDashboard} />
      <Route path="/dashboard" component={GuardedDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={false}>
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
