// src/lib/signature-store.ts
import { createStore, produce } from "solid-js/store";

export interface Signature {
  id: string;
  name: string;
  html: string;
  createdAt: number;
}

export interface SignatureState {
  signatures: Signature[];
  defaultId: string | null;
}

const STORAGE_KEY = "emailSignatures";

function loadFromStorage(): SignatureState {
  if (typeof window === "undefined") return { signatures: [], defaultId: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SignatureState;
      if (parsed && Array.isArray(parsed.signatures)) return parsed;
    }
    // Migrate from old single-signature format
    const legacy = localStorage.getItem("emailSignature");
    if (legacy) {
      const migrated: SignatureState = {
        signatures: [{ id: crypto.randomUUID(), name: "My Signature", html: legacy, createdAt: Date.now() }],
        defaultId: null,
      };
      migrated.defaultId = migrated.signatures[0].id;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem("emailSignature");
      return migrated;
    }
  } catch {
    // ignore
  }
  return { signatures: [], defaultId: null };
}

const [signatureState, setSignatureState] = createStore<SignatureState>(loadFromStorage());

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ signatures: signatureState.signatures, defaultId: signatureState.defaultId }));
  // Keep legacy key in sync for backward compat during transition
  const def = getDefaultSignature();
  if (def) {
    localStorage.setItem("emailSignature", def.html);
  } else {
    localStorage.removeItem("emailSignature");
  }
}

export { signatureState };

export function addSignature(name: string, html: string): string {
  const id = crypto.randomUUID();
  setSignatureState(
    produce((s) => {
      s.signatures.push({ id, name, html, createdAt: Date.now() });
      if (s.signatures.length === 1) s.defaultId = id;
    })
  );
  persist();
  return id;
}

export function updateSignature(id: string, updates: Partial<Pick<Signature, "name" | "html">>) {
  setSignatureState(
    produce((s) => {
      const sig = s.signatures.find((x) => x.id === id);
      if (!sig) return;
      if (updates.name !== undefined) sig.name = updates.name;
      if (updates.html !== undefined) sig.html = updates.html;
    })
  );
  persist();
}

export function removeSignature(id: string) {
  setSignatureState(
    produce((s) => {
      s.signatures = s.signatures.filter((x) => x.id !== id);
      if (s.defaultId === id) {
        s.defaultId = s.signatures.length > 0 ? s.signatures[0].id : null;
      }
    })
  );
  persist();
}

export function setDefaultSignature(id: string | null) {
  setSignatureState("defaultId", id);
  persist();
}

export function getDefaultSignature(): Signature | null {
  if (!signatureState.defaultId) return null;
  return signatureState.signatures.find((s) => s.id === signatureState.defaultId) ?? null;
}

export function getSignatureById(id: string): Signature | null {
  return signatureState.signatures.find((s) => s.id === id) ?? null;
}

export function getSignatureHtml(id?: string | null): string {
  if (id) {
    const sig = getSignatureById(id);
    return sig?.html ?? "";
  }
  const def = getDefaultSignature();
  return def?.html ?? "";
}
