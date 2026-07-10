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
    .then(() => import("./simple-tests-consolidated.js"))
    .catch((error) => {
      console.error("[JW Modbus Tool] Simple tests consolidated view failed to load", error);
    });
}, 0);
