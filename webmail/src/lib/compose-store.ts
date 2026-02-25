// src/lib/compose-store.ts
import { createSignal } from "solid-js";
import { settings } from "./settings-store";
import { saveDraft } from "~/lib/mail-client-browser";

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export interface ComposeState {
  isOpen: boolean;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  quotedEmail?: {
    rawHtml: string;
    headerHtml: string;
    quoteType: "forward" | "reply";
  };
  attachments: AttachmentFile[];
  minimized: boolean;
  fullscreen: boolean;
  showCc: boolean;
  showBcc: boolean;
  draftSaved: boolean;
  lastSavedAt: number | null;
}

export interface OpenComposeOptions {
  restoreLocalDraft?: boolean;
}

const defaultState: ComposeState = {
  isOpen: false,
  to: [],
  cc: [],
  bcc: [],
  subject: "",
  body: "",
  quotedEmail: undefined,
  attachments: [],
  minimized: false,
  fullscreen: false,
  showCc: false,
  showBcc: false,
  draftSaved: false,
  lastSavedAt: null,
};

const [composeState, setComposeState] = createSignal<ComposeState>(defaultState);

export { composeState };

const LOCAL_DRAFT_KEY = "webmail.compose.draft.v1";
const LOCAL_FULLSCREEN_KEY = "webmail.compose.fullscreen.v1";
let localPersistTimer: ReturnType<typeof setTimeout> | null = null;
let unloadListenersBound = false;

interface PersistedComposeDraft {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  showCc: boolean;
  showBcc: boolean;
  updatedAt: number;
}

function hasComposeContent(state: ComposeState): boolean {
  return state.to.length > 0 || state.subject.trim().length > 0 || state.body.trim().length > 0;
}

function toPersistedDraft(state: ComposeState): PersistedComposeDraft {
  return {
    to: [...state.to],
    cc: [...state.cc],
    bcc: [...state.bcc],
    subject: state.subject,
    body: state.body,
    showCc: state.showCc,
    showBcc: state.showBcc,
    updatedAt: Date.now(),
  };
}

function persistDraftLocally(state: ComposeState): void {
  if (typeof window === "undefined") return;
  try {
    if (hasComposeContent(state)) {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(toPersistedDraft(state)));
    } else {
      localStorage.removeItem(LOCAL_DRAFT_KEY);
    }
  } catch {
    // Ignore localStorage errors in private mode/full storage.
  }
}

function readPersistedDraft(): PersistedComposeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedComposeDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    const to = Array.isArray(parsed.to) ? parsed.to.filter((v) => typeof v === "string") : [];
    const cc = Array.isArray(parsed.cc) ? parsed.cc.filter((v) => typeof v === "string") : [];
    const bcc = Array.isArray(parsed.bcc) ? parsed.bcc.filter((v) => typeof v === "string") : [];
    const subject = typeof parsed.subject === "string" ? parsed.subject : "";
    const body = typeof parsed.body === "string" ? parsed.body : "";
    const showCc = Boolean(parsed.showCc);
    const showBcc = Boolean(parsed.showBcc);
    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now();

    const persisted: PersistedComposeDraft = { to, cc, bcc, subject, body, showCc, showBcc, updatedAt };
    return hasComposeContent({ ...defaultState, ...persisted, isOpen: true, draftSaved: false, lastSavedAt: null, attachments: [], minimized: false, fullscreen: false })
      ? persisted
      : null;
  } catch {
    return null;
  }
}

function scheduleLocalPersist(): void {
  if (localPersistTimer) clearTimeout(localPersistTimer);
  localPersistTimer = setTimeout(() => {
    localPersistTimer = null;
    persistDraftLocally(composeState());
  }, 300);
}

function clearLocalDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_DRAFT_KEY);
  } catch {
    // ignore
  }
}

function readPersistedFullscreen(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_FULLSCREEN_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

function persistFullscreen(fullscreen: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_FULLSCREEN_KEY, fullscreen ? "true" : "false");
  } catch {
    // Ignore localStorage errors in private mode/full storage.
  }
}

async function saveDraftRemote(state: ComposeState): Promise<void> {
  await saveDraft(
    state.to.join(", "),
    state.subject,
    state.body,
    state.cc.length > 0 ? state.cc.join(", ") : undefined,
    state.bcc.length > 0 ? state.bcc.join(", ") : undefined
  );
}

function attemptEmergencySave(): void {
  const state = composeState();
  if (!state.isOpen || !hasComposeContent(state)) return;
  persistDraftLocally(state);
  void saveDraftRemote(state).then(() => {
    setComposeState((prev) => ({ ...prev, draftSaved: true, lastSavedAt: Date.now() }));
  }).catch(() => {
    // Best-effort remote save for abrupt tab close/navigation.
  });
}

function bindUnloadListeners(): void {
  if (typeof window === "undefined" || unloadListenersBound) return;
  const onBeforeUnload = () => attemptEmergencySave();
  const onPageHide = () => attemptEmergencySave();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") attemptEmergencySave();
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);
  unloadListenersBound = true;
}

export const openCompose = (
  data?: Partial<Pick<ComposeState, "to" | "cc" | "bcc" | "subject" | "body" | "quotedEmail" | "showCc" | "showBcc">>,
  options?: OpenComposeOptions
) => {
  bindUnloadListeners();

  const hasPrefilledData = Boolean(
    (data?.to && data.to.length > 0) ||
    (data?.cc && data.cc.length > 0) ||
    (data?.bcc && data.bcc.length > 0) ||
    (data?.subject && data.subject.trim()) ||
    (data?.body && data.body.trim())
  );
  const persisted = options?.restoreLocalDraft && !hasPrefilledData ? readPersistedDraft() : null;
  const persistedFullscreen = readPersistedFullscreen();

  const body = data?.body ?? persisted?.body ?? "";

  setComposeState((prev) => ({
    ...prev,
    isOpen: true,
    minimized: false,
    fullscreen: persistedFullscreen ?? settings.composer === "full",
    to: data?.to ?? persisted?.to ?? [],
    cc: data?.cc ?? persisted?.cc ?? [],
    bcc: data?.bcc ?? persisted?.bcc ?? [],
    subject: data?.subject ?? persisted?.subject ?? "",
    body,
    quotedEmail: data?.quotedEmail,
    attachments: [],
    showCc: data?.showCc ?? persisted?.showCc ?? (data?.cc && data.cc.length > 0 ? true : false),
    showBcc: data?.showBcc ?? persisted?.showBcc ?? (data?.bcc && data.bcc.length > 0 ? true : false),
    draftSaved: false,
    lastSavedAt: null,
  }));
};

export const closeCompose = (options?: { save?: boolean }) => {
  const state = composeState();
  const shouldSave = options?.save !== false;
  const hasContent = hasComposeContent(state);
  if (state.isOpen && hasContent) {
    persistDraftLocally(state);
  }
  if (shouldSave && state.isOpen && hasContent && !state.draftSaved) {
    void saveDraftRemote(state).then(() => {
      setComposeState((prev) => ({ ...prev, draftSaved: true, lastSavedAt: Date.now() }));
    }).catch(() => {
      // Silent fail on close; user can continue editing in next compose.
    });
  }
  setComposeState((prev) => ({ ...prev, isOpen: false }));
};

export const toggleMinimize = (min?: boolean) => {
  setComposeState((prev) => ({
    ...prev,
    minimized: min !== undefined ? min : !prev.minimized,
  }));
};

export const toggleFullscreen = () => {
  setComposeState((prev) => {
    const nextFullscreen = !prev.fullscreen;
    persistFullscreen(nextFullscreen);
    return {
      ...prev,
      fullscreen: nextFullscreen,
    };
  });
};

export const updateComposeField = (field: keyof ComposeState, value: any) => {
  setComposeState((prev) => ({ ...prev, [field]: value, draftSaved: false }));
  scheduleLocalPersist();
};

export const toggleCc = () => {
  setComposeState((prev) => ({ ...prev, showCc: !prev.showCc, draftSaved: false }));
  scheduleLocalPersist();
};

export const toggleBcc = () => {
  setComposeState((prev) => ({ ...prev, showBcc: !prev.showBcc, draftSaved: false }));
  scheduleLocalPersist();
};

export const addAttachments = (files: File[]) => {
  const promises = files.map((file) => {
    return new Promise<AttachmentFile>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    });
  });

  Promise.all(promises).then((attachments) => {
    setComposeState((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...attachments],
      draftSaved: false,
    }));
    scheduleLocalPersist();
  });
};

export const removeAttachment = (id: string) => {
  setComposeState((prev) => ({
    ...prev,
    attachments: prev.attachments.filter((a) => a.id !== id),
    draftSaved: false,
  }));
  scheduleLocalPersist();
};

export const discardComposeDraft = () => {
  clearLocalDraft();
  setComposeState((prev) => ({
    ...prev,
    to: [],
    cc: [],
    bcc: [],
    subject: "",
    body: "",
    quotedEmail: undefined,
    attachments: [],
    showCc: false,
    showBcc: false,
    draftSaved: false,
    lastSavedAt: null,
  }));
};

export async function saveComposeDraftNow(): Promise<boolean> {
  const state = composeState();
  if (!state.isOpen || !hasComposeContent(state)) return false;
  persistDraftLocally(state);
  await saveDraftRemote(state);
  setComposeState((prev) => ({ ...prev, draftSaved: true, lastSavedAt: Date.now() }));
  return true;
}

// Auto-save draft logic
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoSave() {
  stopAutoSave();
  autoSaveTimer = setInterval(async () => {
    const state = composeState();
    if (!state.isOpen) return;
    // Only save if there's content to save
    if (!hasComposeContent(state)) return;
    if (state.draftSaved) return;

    try {
      await saveDraftRemote(state);
      persistDraftLocally(state);
      setComposeState((prev) => ({ ...prev, draftSaved: true, lastSavedAt: Date.now() }));
    } catch {
      // Silent fail for auto-save
    }
  }, 30000); // Auto-save every 30 seconds
}

export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (localPersistTimer) {
    clearTimeout(localPersistTimer);
    localPersistTimer = null;
  }
}
