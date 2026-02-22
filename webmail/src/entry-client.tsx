// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

mount(() => <StartClient />, document.getElementById("app")!);
