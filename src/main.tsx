import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativeApp } from "./lib/nativeInit";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Глобальные ловушки, чтобы ошибки выводились в logcat (Capacitor/Console),
// а не молча роняли WebView.
window.addEventListener("error", (e) => {
  console.error("[window.error]", e.message, e.error?.stack);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason?.message ?? e.reason, e.reason?.stack);
});

initNativeApp();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
