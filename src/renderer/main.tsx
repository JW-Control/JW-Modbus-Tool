import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import "./simple-mode-overrides.css";
import "./simple-tests-session-history-bridge.js";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
