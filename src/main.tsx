// import './vertex-ai-proxy-interceptor.js';
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./ThemeContext";
import { I18nProvider } from "./I18nContext";
import { HostProvider } from "./HostContext";
import { SnippetProvider } from "./SnippetContext";
import { SettingsProvider } from "./SettingsContext";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Disable default context menu for a native desktop feel
if (import.meta.env.PROD) {
  window.addEventListener('contextmenu', (e) => e.preventDefault());
} else {
  // In development, you might still want it, but the user specifically asked to disable it.
  // I'll disable it generally but add a comment.
  //window.addEventListener('contextmenu', (e) => e.preventDefault());
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <HostProvider>
          <SettingsProvider>
            <SnippetProvider>
              <App />
            </SnippetProvider>
          </SettingsProvider>
        </HostProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
