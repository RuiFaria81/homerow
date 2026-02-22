// Client-side SSE connection to /api/mail-events.
//
// Provides a global reactive signal that fires whenever the sync engine
// pushes a real-time event (new message, flag change, expunge, folder sync).
// Components subscribe to this signal to trigger instant refetches.
// Also sends browser notifications for new emails.

import { createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { settings } from "~/lib/settings-store";
import { isBlockedSenderCandidate } from "~/lib/blocked-senders-cache";

export interface MailEvent {
  type: "new_message" | "flags_changed" | "expunge" | "folder_synced";
  folder?: string;
  uid?: number;
  subject?: string;
  from?: string;
  fromAddress?: string;
}

// Global event counter — bumps on every SSE event, triggering reactive updates
const [mailEventTrigger, setMailEventTrigger] = createSignal(0);

// Last event payload for components that need it
const [lastMailEvent, setLastMailEvent] = createSignal<MailEvent | null>(null);

// Connection status
const [sseConnected, setSseConnected] = createSignal(false);

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let subscriberCount = 0;
let pendingEventTimer: ReturnType<typeof setTimeout> | null = null;
let notificationWindowStart = 0;
let notificationCountInWindow = 0;
const NOTIFICATION_WINDOW_MS = 60_000;
const MAX_NOTIFICATIONS_PER_WINDOW = 3;

// -------------------------------------------------------------------------
// Browser Notifications
// -------------------------------------------------------------------------

let notificationsPermission: NotificationPermission = "default";

function initNotifications() {
  if (isServer || !("Notification" in window)) return;
  notificationsPermission = Notification.permission;
}

/** Request permission for browser notifications. Call from a user gesture. */
export function requestNotificationPermission() {
  if (isServer || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    notificationsPermission = "granted";
    return;
  }
  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      notificationsPermission = perm;
    });
  }
}

function showBrowserNotification(event: MailEvent) {
  if (isServer || !("Notification" in window)) return;
  if (!settings.notifications) return;
  if (notificationsPermission !== "granted") return;
  if (event.type !== "new_message") return;
  if (localStorage.getItem("takeoutImportActive") === "true") return;
  if (isBlockedSenderCandidate({ fromAddress: event.fromAddress, fromLabel: event.from })) return;

  // Don't notify if the tab is currently focused
  if (document.visibilityState === "visible") return;

  const now = Date.now();
  if (now - notificationWindowStart > NOTIFICATION_WINDOW_MS) {
    notificationWindowStart = now;
    notificationCountInWindow = 0;
  }
  if (notificationCountInWindow >= MAX_NOTIFICATIONS_PER_WINDOW) return;
  notificationCountInWindow += 1;

  try {
    const title = event.from || "New email";
    const body = event.subject || "(No Subject)";

    const notification = new Notification(title, {
      body,
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag: `mail-${event.uid}`, // Deduplicate by UID
      silent: false,
    });

    // Focus the app when clicking the notification
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);
  } catch {
    // Notification API error, ignore
  }
}

// -------------------------------------------------------------------------
// SSE Connection
// -------------------------------------------------------------------------

function connect() {
  if (isServer || eventSource) return;

  initNotifications();

  try {
    const es = new EventSource("/api/mail-events");

    es.addEventListener("connected", () => {
      setSseConnected(true);
      console.log("[SSE] Connected to mail events");
    });

    es.addEventListener("mail", (e) => {
      try {
        const event: MailEvent = JSON.parse(e.data);
        setLastMailEvent(event);

        // Batch rapid event bursts to avoid UI thrash during large imports/sync bursts.
        if (!pendingEventTimer) {
          pendingEventTimer = setTimeout(() => {
            pendingEventTimer = null;
            setMailEventTrigger((n) => n + 1);
          }, 800);
        }

        // Show browser notification for new messages
        showBrowserNotification(event);
      } catch {
        // Invalid JSON payload, ignore
      }
    });

    es.onerror = () => {
      setSseConnected(false);
      es.close();
      eventSource = null;

      // Reconnect after a delay
      if (subscriberCount > 0) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    eventSource = es;
  } catch {
    // EventSource not available or connection failed
    setSseConnected(false);
  }
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (pendingEventTimer) {
    clearTimeout(pendingEventTimer);
    pendingEventTimer = null;
  }
  setSseConnected(false);
}

/**
 * Subscribe to real-time mail events. Call this in a component's setup.
 * Automatically manages the SSE connection lifecycle — connects when
 * the first subscriber appears, disconnects when the last one leaves.
 */
export function useMailEvents() {
  subscriberCount++;

  if (subscriberCount === 1) {
    connect();
  }

  onCleanup(() => {
    subscriberCount--;
    if (subscriberCount <= 0) {
      subscriberCount = 0;
      disconnect();
    }
  });

  return {
    /** Reactive counter — track this to re-run effects on any mail event */
    trigger: mailEventTrigger,
    /** The most recent event payload */
    lastEvent: lastMailEvent,
    /** Whether the SSE connection is active */
    connected: sseConnected,
  };
}
