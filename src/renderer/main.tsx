import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import "./simple-mode-overrides.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

window.setTimeout(() => {
  void import("./simple-tests-persistence-bridge.js")
    .then(() => import("./simple-modbus-result-compat.js"))
    .then(() => import("./simple-tests-runtime-safe.js"))
    .catch((error) => {
      console.error("[JW Modbus Tool] Simple tests runtime failed to load", error);
    });
}, 0);
