import { createRoot } from "react-dom/client";
import { LogtoProvider, LogtoConfig, UserScope } from "@logto/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./app/App.tsx";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import "./styles/index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

// Logto configuration
const logtoConfig: LogtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT,
  appId: import.meta.env.VITE_LOGTO_APP_ID,
  scopes: [UserScope.Email, UserScope.Profile],
};

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <LogtoProvider config={logtoConfig}>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </LogtoProvider>
  </ErrorBoundary>
);
