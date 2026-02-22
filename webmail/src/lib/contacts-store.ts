// src/lib/contacts-store.ts
import { createSignal } from "solid-js";
import { fetchSentContacts } from "./mail-client";

const [contacts, setContacts] = createSignal<string[]>([]);
let loaded = false;

export { contacts };

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeContacts = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const normalized = new Set<string>();

  for (const entry of input) {
    const raw =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && typeof (entry as { email?: unknown }).email === "string"
          ? (entry as { email: string }).email
          : null;

    if (!raw) continue;
    const email = raw.trim().toLowerCase();
    if (!isValidEmail(email)) continue;
    normalized.add(email);
  }

  return Array.from(normalized);
};

export async function loadContacts() {
  if (loaded) return;
  loaded = true;

  // Load from localStorage first for instant results
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("contactsCache");
      if (stored) {
        const localContacts = normalizeContacts(JSON.parse(stored));
        setContacts(localContacts);
        localStorage.setItem("contactsCache", JSON.stringify(localContacts));
      }
    } catch {}
  }

  // Then fetch from server in background
  try {
    const serverContacts = normalizeContacts(await fetchSentContacts());
    if (serverContacts.length > 0) {
      // Merge with existing
      const merged = normalizeContacts([...contacts(), ...serverContacts]);
      setContacts(merged);
      if (typeof window !== "undefined") {
        localStorage.setItem("contactsCache", JSON.stringify(merged));
      }
    }
  } catch {
    // Silent fail
  }
}

export function addContact(email: string) {
  const lower = email.toLowerCase().trim();
  if (!isValidEmail(lower)) return;
  if (!lower) return;
  if (contacts().includes(lower)) return;
  const updated = normalizeContacts([...contacts(), lower]);
  setContacts(updated);
  if (typeof window !== "undefined") {
    localStorage.setItem("contactsCache", JSON.stringify(updated));
  }
}
