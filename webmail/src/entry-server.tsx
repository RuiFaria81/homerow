// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Homerow</title>
          <link rel="manifest" href="/manifest.webmanifest" />
          <meta name="theme-color" content="#0f766e" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="icon" sizes="192x192" href="/pwa-192.png" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/pwa-192.png" />
          <link rel="icon" type="image/x-icon" href="/favicon.ico" />
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
