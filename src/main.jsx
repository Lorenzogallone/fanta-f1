/**
 * @file main.jsx
 * @description Application entry point - initializes React root and renders App component
 */

import "bootstrap/dist/css/bootstrap.min.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Auto-reload when a new service worker takes control (after deploy).
// This ensures users always see the latest version without manual refresh.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  // First install has no previous controller: nothing to update, don't reload the splash
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
