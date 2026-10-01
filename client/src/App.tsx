import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

const isLoggedIn = () => sessionStorage.getItem("loggedIn") === "true";

function GuardedDashboard() {
  if (!isLoggedIn()) return <Redirect to="/login" />;
  return <Dashboard />;
}

function LoginGate() {
  if (isLoggedIn()) return <Redirect to="/dashboard" />;
  return <Login />;
}

function Router() {
  return (
    <Switch>
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
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
