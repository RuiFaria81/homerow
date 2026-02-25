// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

const parseBooleanEnv = (value?: string) => !!value && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
const demoStatic = import.meta.env.BASE_URL.includes("/webmail-demo/") || parseBooleanEnv(import.meta.env.WEBMAIL_DEMO_STATIC);

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  if (demoStatic) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
    });
  } else {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(swUrl).catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    });
  }
}

mount(() => <StartClient />, document.getElementById("app")!);
