import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { ApplicationErrorBoundary } from "@/app/ApplicationErrorBoundary";
import { OperationalProvider } from "@/state/operations/OperationalContext";
// Nạp CSS nền của MapLibre: định vị canvas/marker/control — thiếu nó thì
// DOM marker bị trôi vị trí khi thay đổi zoom/cuộn trang.
import "maplibre-gl/dist/maplibre-gl.css";
import "@/styles/global.css";
import "@/styles/shell.css";
import "@/styles/command-center.css";
import "@/styles/incidents.css";
import "@/styles/tasks.css";
import "@/styles/teams.css";
import "@/styles/shelters.css";
import "@/styles/sos.css";
import "@/styles/relief.css";
import "@/styles/playbooks.css";
import "@/styles/recovery.css";
import "@/styles/analytics.css";
import "@/styles/simulation.css";
import "@/styles/auth.css";
import "@/styles/ai-assistant.css";
import "@/styles/alerts.css";
import "@/styles/evacuations.css";
import "@/styles/operational-map.css";
import "@/styles/operational-insights.css";
import "@/styles/citizen.css";
import "@/styles/interface-polish.css";
import "@/styles/compact-ui.css";

document.documentElement.dataset.theme =
  localStorage.getItem("vndms-theme") === "dark" ? "dark" : "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApplicationErrorBoundary>
      <OperationalProvider>
        <App />
      </OperationalProvider>
    </ApplicationErrorBoundary>
  </StrictMode>,
);
