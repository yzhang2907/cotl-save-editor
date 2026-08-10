import "@fontsource/lilita-one/latin-400.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-900.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Imported ahead of the app so the base sheet — tokens, element defaults, and
// the shared recipes — is emitted before the component sheets that override it.
import "./styles.css";
import { App } from "./app";

const rootElement = document.querySelector("#app");
if (!rootElement) {
  throw new Error("The application root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
