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

void import("./simple-tests-runtime.js").catch((error) => {
  console.error("[JW Modbus Tool] Simple tests runtime failed to load", error);
});
