import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import "./simple-mode-overrides.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);

window.setTimeout(() => {
  import("./simple-tests-session-history-bridge.js").catch((error) => {
    console.warn("No se pudo cargar el historial de pruebas de sesión.", error);
  });
}, 0);
