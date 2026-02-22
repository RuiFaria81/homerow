// SSE endpoint — streams real-time mail events to the browser.
//
// The sync engine fires PostgreSQL NOTIFY on the 'mail_events' channel
// whenever new messages arrive, flags change, or folders sync.
// This endpoint LISTENs on that channel and forwards events as SSE.

import type { APIEvent } from "@solidjs/start/server";
import pg from "pg";
import { runSnoozeSweep } from "~/lib/mail-client";

// Shared LISTEN client — one per server process, fans out to all SSE clients.
// This avoids opening one PG connection per browser tab.

type Listener = (payload: string) => void;

let listeners: Set<Listener> = new Set();
let pgClient: pg.Client | null = null;
let connecting = false;

async function ensurePgListener() {
  if (pgClient || connecting) return;
  connecting = true;

  try {
    const client = new pg.Client({
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "mailsync",
      user: process.env.DB_USER || "mailsync",
      password: process.env.DB_PASSWORD || "mailsync",
    });

    client.on("notification", (msg) => {
      if (msg.channel === "mail_events" && msg.payload) {
        for (const fn of listeners) {
          try {
            fn(msg.payload);
          } catch {
            // Ignore individual listener errors
          }
        }
      }
    });

    client.on("error", (err) => {
      console.error("[SSE] PG listener error:", err.message);
      pgClient = null;
      // Reconnect after a short delay
      setTimeout(() => {
        connecting = false;
        if (listeners.size > 0) ensurePgListener();
      }, 3000);
    });

    client.on("end", () => {
      pgClient = null;
      // Reconnect if there are still active listeners
      setTimeout(() => {
        connecting = false;
        if (listeners.size > 0) ensurePgListener();
      }, 3000);
    });

    await client.connect();
    await client.query("LISTEN mail_events");
    pgClient = client;
    console.log("[SSE] PostgreSQL LISTEN established on mail_events");
  } catch (err) {
    console.error("[SSE] Failed to connect PG listener:", err);
    setTimeout(() => {
      connecting = false;
      if (listeners.size > 0) ensurePgListener();
    }, 5000);
  } finally {
    connecting = false;
  }
}

function cleanupPgListener() {
  if (listeners.size === 0 && pgClient) {
    pgClient.end().catch(() => {});
    pgClient = null;
    console.log("[SSE] No listeners remaining, closed PG connection");
  }
}

export async function GET({ request }: APIEvent) {
  // Set up SSE response
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      };

      // Send initial connected event
      send("connected", JSON.stringify({ status: "ok" }));

      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Register for PG notifications
      const onNotification: Listener = (payload) => {
        send("mail", payload);
      };

      listeners.add(onNotification);
      ensurePgListener();
      void runSnoozeSweep().catch((err) => {
        console.error("[SSE] initial snooze sweep failed:", err);
      });

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        listeners.delete(onNotification);
        cleanupPgListener();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
