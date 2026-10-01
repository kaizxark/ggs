import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <div className="panel w-full max-w-lg p-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: "rgba(240,88,60,.14)" }}
            />
            <AlertCircle
              className="relative h-16 w-16"
              style={{ color: "#f0886a" }}
            />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-2" style={{ color: "#e7ebef" }}>
          404
        </h1>

        <h2
          className="text-xl font-semibold mb-4"
          style={{ color: "#d7dee4" }}
        >
          Page Not Found
        </h2>

        <p className="mb-8 leading-relaxed" style={{ color: "#8b96a0" }}>
          Sorry, the page you are looking for doesn't exist.
          <br />
          It may have been moved or deleted.
        </p>

        <div
          id="not-found-button-group"
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={handleGoHome}
            className="primary-button inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
