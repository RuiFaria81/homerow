// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

const assetPath = (value: string) => `${import.meta.env.BASE_URL}${value.replace(/^\/+/, "")}`;
const parseBooleanEnv = (value?: string) => !!value && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
const demoStatic =
  import.meta.env.BASE_URL.includes("/demo/") ||
  import.meta.env.BASE_URL.includes("/webmail-demo/") ||
  parseBooleanEnv(import.meta.env.WEBMAIL_DEMO_STATIC);

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Homerow</title>
          {!demoStatic && (
            <>
              <link rel="manifest" href={assetPath("/manifest.webmanifest")} />
              <meta name="theme-color" content="#0f766e" />
              <meta name="mobile-web-app-capable" content="yes" />
              <meta name="apple-mobile-web-app-capable" content="yes" />
              <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            </>
          )}
          <link rel="icon" type="image/svg+xml" href={assetPath("/favicon.svg")} />
          {!demoStatic && <link rel="icon" sizes="192x192" href={assetPath("/pwa-192-minimal.png")} />}
          <link rel="icon" href={assetPath("/favicon.ico")} />
          {!demoStatic && <link rel="apple-touch-icon" href={assetPath("/pwa-192-minimal.png")} />}
          <link rel="icon" type="image/x-icon" href={assetPath("/favicon.ico")} />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
