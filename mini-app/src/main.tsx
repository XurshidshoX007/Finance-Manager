import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initTelegram } from "./services/telegram";

// Telegram'ga ilova tayyorligini bildiramiz (aks holda yuklanish
// ekrani ochiq qolib ketadi) va mavzu ranglarini o'rnatamiz.
initTelegram();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
