// src/routes/settings.tsx
import { createSignal, Show, For, createEffect, onCleanup, createMemo, untrack, createResource, onMount } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { settings, setSettings, ReadingPanePosition, THEMES, FONTS, type ThemeId, type FontId } from "~/lib/settings-store";
import { IconBack, IconInbox, IconLabel, IconMail, IconClose, IconPlus, IconEdit, IconTrash, IconSignature, IconFolder, IconUsers, IconInfo, IconSparkles, IconBriefcase, IconCart, IconReceipt, IconHeart, IconCode, IconBolt, IconCategories, IconChevronDown, IconBlock, IconSend, IconImport } from "~/components/Icons";
import { addLabel, updateLabel, removeLabel, LABEL_COLORS, getVisibleLabels, getConfiguredCategories, addCategory, removeCategory, updateCategory, normalizeCategoryNameToKey, type CategoryIconId } from "~/lib/labels-store";
import {
  autoLabelRulesState,
  addAutoLabelRule,
  removeAutoLabelRule,
  updateAutoLabelRule,
  updateAutoLabelRulesSettings,
  type DestinationTargetField,
  type DestinationMatchType,
  type LabelResolutionMode,
} from "~/lib/auto-label-rules-store";
import { signatureState, addSignature, updateSignature, removeSignature, setDefaultSignature } from "~/lib/signature-store";
import { clearPaginationCache, getPaginationCacheStats } from "~/lib/pagination-cache";
import { showToast } from "~/lib/toast-store";
import { authClient } from "~/lib/auth-client";
import { getBlockedSenders, unblockSender, blockSender, getAutoReplySettings, saveAutoReplySettings, type AutoReplySettings } from "~/lib/mail-client";
import { cacheBlockedSenderEmails } from "~/lib/blocked-senders-cache";
import { getUpdateStatusClient } from "~/lib/update-status-client";
import hotkeys from "hotkeys-js";
import { SHORTCUT_ACTIONS, shortcutBindings, setShortcutBinding, restoreDefaultShortcuts, formatShortcut, normalizeShortcut, getShortcutConflictMap, type ShortcutActionId } from "~/lib/keyboard-shortcuts-store";
import QRCode from "qrcode";
import LexicalEditor from "~/components/LexicalEditor";

type SettingsTab = "general" | "shortcuts" | "appearance" | "labels" | "categories" | "signature" | "import" | "accounts" | "blocked" | "auto-reply";
type ImportSourceMode = "upload" | "server";
type TakeoutImportMode = "label" | "category";

interface TakeoutImportJob {
  id: string;
  status: "created" | "uploading" | "queued" | "running" | "completed" | "failed" | "cancelled";
  sourceFilename: string;
  fileSizeBytes: number;
  uploadedBytes: number;
  processedMessages: number;
  importedMessages: number;
  dbImportedMessages: number;
  imapSyncedMessages: number;
  skippedMessages: number;
  errorCount: number;
  estimatedTotalMessages: number | null;
  estimationInProgress: boolean;
  estimationScannedBytes: number;
  estimationTotalBytes: number;
  startedAt: string | null;
  lastError: string | null;
  options?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface TakeoutAnalyzedSignature {
  title: string;
  text: string;
}

interface TakeoutAnalyzedLabel {
  name: string;
  count: number;
}

interface TakeoutArchiveAnalysis {
  estimatedTotalMessages: number;
  customLabels: TakeoutAnalyzedLabel[];
  systemLabels: {
    sent: number;
    spam: number;
    trash: number;
    drafts: number;
    inbox: number;
    archive: number;
  };
  signatures: TakeoutAnalyzedSignature[];
  blockedSenders: string[];
}

interface ServerTakeoutArchiveFile {
  filename: string;
  fileSizeBytes: number;
  modifiedAt: string;
}

interface LabelImportPlanItem {
  sourceName: string;
  targetName: string;
  color: string;
  enabled: boolean;
  count: number;
  importMode: TakeoutImportMode;
}

interface SignatureImportPlanItem {
  title: string;
  html: string;
  enabled: boolean;
}

const MAX_AVATAR_UPLOAD_BYTES = 1_500_000;
const AVATAR_MAX_DIMENSION = 512;
const TAKEOUT_CATEGORY_LABEL_PATTERN = /^category\s+(.+)$/i;

const extractTakeoutCategoryName = (labelName: string): string | null => {
  const match = TAKEOUT_CATEGORY_LABEL_PATTERN.exec(labelName.trim());
  const raw = match?.[1]?.trim();
  return raw ? raw : null;
};

const normalizeTargetNameForMode = (sourceName: string, targetName: string, mode: TakeoutImportMode): string => {
  if (mode === "category") {
    const fromTarget = extractTakeoutCategoryName(targetName);
    const fromSource = extractTakeoutCategoryName(sourceName);
    const raw = fromTarget || targetName || fromSource || sourceName;
    return raw
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part)
      .join(" ");
  }
  const fromSource = extractTakeoutCategoryName(sourceName);
  if (fromSource) {
    const trimmed = targetName.trim();
    const formattedSource = normalizeTargetNameForMode(sourceName, fromSource, "category");
    if (!trimmed || trimmed.toLowerCase() === formattedSource.toLowerCase()) {
      return sourceName;
    }
  }
  return targetName.trim();
};

const toTakeoutMappingTargetName = (item: { sourceName: string; targetName: string; importMode: TakeoutImportMode }): string => {
  const trimmed = item.targetName.trim();
  if (item.importMode === "category") {
    const base = trimmed || extractTakeoutCategoryName(item.sourceName) || item.sourceName;
    return `Category ${base.trim()}`.replace(/\s+/g, " ").trim();
  }
  return trimmed;
};

export default function Settings() {
  let takeoutFileInputRef: HTMLInputElement | undefined;
  let profileAvatarInputRef: HTMLInputElement | undefined;
  const [searchParams] = useSearchParams();
  const session = authClient.useSession();
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("general");
  const [editingLabel, setEditingLabel] = createSignal<string | null>(null);
  const [newLabelName, setNewLabelName] = createSignal("");
  const [newLabelColor, setNewLabelColor] = createSignal(LABEL_COLORS[0]);
  const [newCategoryName, setNewCategoryName] = createSignal("");
  const [openCategoryIconPicker, setOpenCategoryIconPicker] = createSignal<string | null>(null);
  const [showNewLabel, setShowNewLabel] = createSignal(false);
  const [editingSignatureId, setEditingSignatureId] = createSignal<string | null>(null);
  const [signatureEditorHtml, setSignatureEditorHtml] = createSignal("");
  const [signatureEditorName, setSignatureEditorName] = createSignal("");
  const [signatureSaved, setSignatureSaved] = createSignal(false);
  const [showNewSignature, setShowNewSignature] = createSignal(false);
  const [signatureEditorKey, setSignatureEditorKey] = createSignal(0);
  const [selectedTakeoutFile, setSelectedTakeoutFile] = createSignal<File | null>(null);
  const [takeoutJob, setTakeoutJob] = createSignal<TakeoutImportJob | null>(null);
  const [takeoutBusy, setTakeoutBusy] = createSignal(false);
  const [takeoutUploadPercent, setTakeoutUploadPercent] = createSignal(0);
  const [takeoutError, setTakeoutError] = createSignal<string | null>(null);
  const [takeoutAnalysis, setTakeoutAnalysis] = createSignal<TakeoutArchiveAnalysis | null>(null);
  const [takeoutAnalysisJobId, setTakeoutAnalysisJobId] = createSignal<string | null>(null);
  const [takeoutAnalysisBusy, setTakeoutAnalysisBusy] = createSignal(false);
  const [importTakeoutCategories, setImportTakeoutCategories] = createSignal(true);
  const [importTakeoutLabels, setImportTakeoutLabels] = createSignal(true);
  const [importTakeoutSignatures, setImportTakeoutSignatures] = createSignal(true);
  const [importTakeoutBlockedSenders, setImportTakeoutBlockedSenders] = createSignal(true);
  const [takeoutLabelPlan, setTakeoutLabelPlan] = createSignal<LabelImportPlanItem[]>([]);
  const [takeoutSignaturePlan, setTakeoutSignaturePlan] = createSignal<SignatureImportPlanItem[]>([]);
  const [includeSentMessages, setIncludeSentMessages] = createSignal(true);
  const [includeSpamMessages, setIncludeSpamMessages] = createSignal(false);
  const [includeTrashMessages, setIncludeTrashMessages] = createSignal(false);
  const [importSourceMode, setImportSourceMode] = createSignal<ImportSourceMode>("upload");
  const [serverTakeoutFilename, setServerTakeoutFilename] = createSignal("");
  const [deleteServerFileAfterImport, setDeleteServerFileAfterImport] = createSignal(false);
  const [takeoutJobsApiAvailable, setTakeoutJobsApiAvailable] = createSignal(true);
  const [serverTakeoutFiles, setServerTakeoutFiles] = createSignal<ServerTakeoutArchiveFile[]>([]);
  const [serverTakeoutFilesLoading, setServerTakeoutFilesLoading] = createSignal(false);
  const [serverTakeoutFilesUnavailable, setServerTakeoutFilesUnavailable] = createSignal(false);
  const [clearingCache, setClearingCache] = createSignal(false);
  const [cacheStats, setCacheStats] = createSignal<{ pages: number; bytes: number } | null>(null);
  const [loadingCacheStats, setLoadingCacheStats] = createSignal(false);
  const [profileName, setProfileName] = createSignal("");
  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [accountBusy, setAccountBusy] = createSignal<"name" | "password" | "avatar" | "twoFactor" | null>(null);
  const [twoFactorPassword, setTwoFactorPassword] = createSignal("");
  const [twoFactorSetupCode, setTwoFactorSetupCode] = createSignal("");
  const [twoFactorSetupUri, setTwoFactorSetupUri] = createSignal("");
  const [twoFactorQrDataUrl, setTwoFactorQrDataUrl] = createSignal("");
  const [backupCodes, setBackupCodes] = createSignal<string[]>([]);

  const userEmail = () => session().data?.user?.email || "admin@local";
  const userName = () => session().data?.user?.name || "Admin";
  const userImage = () => session().data?.user?.image || "";
  const isTwoFactorEnabled = () =>
    Boolean((session().data?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);
  const userInitial = () => (profileName().trim() || userEmail()).slice(0, 1).toUpperCase() || "A";
  const visibleLabels = createMemo(() => getVisibleLabels());
  const configuredCategories = createMemo(() => getConfiguredCategories());
  const takeoutCategoryPlan = createMemo(() =>
    takeoutLabelPlan().filter((item) => Boolean(extractTakeoutCategoryName(item.sourceName))),
  );
  const takeoutCustomLabelPlan = createMemo(() =>
    takeoutLabelPlan().filter((item) => !extractTakeoutCategoryName(item.sourceName)),
  );
  const [newBlockedSenderEmail, setNewBlockedSenderEmail] = createSignal("");
  const [newBlockedSenderName, setNewBlockedSenderName] = createSignal("");
  const [selectedBlockedSenders, setSelectedBlockedSenders] = createSignal<Set<string>>(new Set());
  const [blockedSendersList, { refetch: refetchBlockedSenders }] = createResource(getBlockedSenders);
  const [updateStatus, { refetch: refetchUpdateStatus }] = createResource(getUpdateStatusClient);

  const [autoReplySettings] = createResource(getAutoReplySettings);
  const [autoReplyEnabled, setAutoReplyEnabled] = createSignal(false);
  const [autoReplySubject, setAutoReplySubject] = createSignal("");
  const [autoReplyBodyHtml, setAutoReplyBodyHtml] = createSignal("");
  const [autoReplyBodyText, setAutoReplyBodyText] = createSignal("");
  const [autoReplyStartDate, setAutoReplyStartDate] = createSignal("");
  const [autoReplyEndDate, setAutoReplyEndDate] = createSignal("");
  const [autoReplySaving, setAutoReplySaving] = createSignal(false);
  const [autoReplyEditorKey, setAutoReplyEditorKey] = createSignal(0);
  const [autoReplyInitialized, setAutoReplyInitialized] = createSignal(false);
  const [autoReplyLastSavedKey, setAutoReplyLastSavedKey] = createSignal("");
  let autoReplySaveTimer: ReturnType<typeof setTimeout> | null = null;
  const [recordingShortcut, setRecordingShortcut] = createSignal<ShortcutActionId | null>(null);

  const buildAutoReplyPayload = (): AutoReplySettings => ({
    enabled: autoReplyEnabled(),
    subject: autoReplySubject(),
    bodyHtml: autoReplyBodyHtml(),
    bodyText: autoReplyBodyText(),
    startDate: autoReplyStartDate() || null,
    endDate: autoReplyEndDate() || null,
  });

  const serializeAutoReplyPayload = (payload: AutoReplySettings): string =>
    JSON.stringify({
      enabled: payload.enabled,
      subject: payload.subject.trim(),
      bodyHtml: payload.bodyHtml,
      bodyText: payload.bodyText,
      startDate: payload.startDate || null,
      endDate: payload.endDate || null,
    });

  const markAutoReplyInitialized = () => {
    if (!autoReplyInitialized()) setAutoReplyInitialized(true);
  };

  const persistAutoReplyPayload = async (payload: AutoReplySettings, payloadKey: string) => {
    setAutoReplySaving(true);
    try {
      await saveAutoReplySettings(payload);
      setAutoReplyLastSavedKey(payloadKey);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auto-reply-settings-updated"));
      }
    } catch {
      showToast("Failed to save auto reply settings", "error");
    } finally {
      setAutoReplySaving(false);
    }
  };

  const scheduleAutoReplySave = (options?: { immediate?: boolean }) => {
    const payload = buildAutoReplyPayload();
    const payloadKey = serializeAutoReplyPayload(payload);
    if (payloadKey === autoReplyLastSavedKey()) return;

    if (autoReplySaveTimer) {
      clearTimeout(autoReplySaveTimer);
      autoReplySaveTimer = null;
    }

    if (options?.immediate) {
      void persistAutoReplyPayload(payload, payloadKey);
      return;
    }

    autoReplySaveTimer = setTimeout(() => {
      autoReplySaveTimer = null;
      void persistAutoReplyPayload(payload, payloadKey);
    }, 400);
  };

  createEffect(() => {
    const data = autoReplySettings();
    if (!data) return;
    if (autoReplyInitialized()) return;
    setAutoReplyEnabled(data.enabled);
    setAutoReplySubject(data.subject);
    setAutoReplyBodyHtml(data.bodyHtml);
    setAutoReplyBodyText(data.bodyText);
    setAutoReplyStartDate(data.startDate ?? "");
    setAutoReplyEndDate(data.endDate ?? "");
    setAutoReplyEditorKey((k) => k + 1);
    setAutoReplyLastSavedKey(
      serializeAutoReplyPayload({
        enabled: data.enabled,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        startDate: data.startDate,
        endDate: data.endDate,
      }),
    );
    setAutoReplyInitialized(true);
  });

  onCleanup(() => {
    if (autoReplySaveTimer) {
      clearTimeout(autoReplySaveTimer);
      autoReplySaveTimer = null;
    }
    const payload = buildAutoReplyPayload();
    const payloadKey = serializeAutoReplyPayload(payload);
    if (payloadKey !== autoReplyLastSavedKey()) {
      void persistAutoReplyPayload(payload, payloadKey);
    }
  });

  const categoryIconOptions: Array<{ id: CategoryIconId; label: string }> = [
    { id: "tag", label: "Tag" },
    { id: "users", label: "Users" },
    { id: "info", label: "Info" },
    { id: "sparkles", label: "Sparkles" },
    { id: "briefcase", label: "Briefcase" },
    { id: "cart", label: "Cart" },
    { id: "receipt", label: "Receipt" },
    { id: "heart", label: "Heart" },
    { id: "code", label: "Code" },
    { id: "bolt", label: "Bolt" },
  ];

  const categoryIconById = (icon: CategoryIconId) => {
    if (icon === "tag") return IconLabel;
    if (icon === "users") return IconUsers;
    if (icon === "info") return IconInfo;
    if (icon === "sparkles") return IconSparkles;
    if (icon === "briefcase") return IconBriefcase;
    if (icon === "cart") return IconCart;
    if (icon === "receipt") return IconReceipt;
    if (icon === "heart") return IconHeart;
    if (icon === "code") return IconCode;
    if (icon === "bolt") return IconBolt;
    return IconSparkles;
  };
  const categoryIconLabel = (icon: CategoryIconId) =>
    categoryIconOptions.find((option) => option.id === icon)?.label || "Icon";

  const startEditSignature = (id: string) => {
    const sig = signatureState.signatures.find((s) => s.id === id);
    if (!sig) return;
    setEditingSignatureId(id);
    setSignatureEditorName(sig.name);
    setSignatureEditorHtml(sig.html);
    setShowNewSignature(false);
    setSignatureSaved(false);
    setSignatureEditorKey((k) => k + 1);
  };

  const startNewSignature = () => {
    setEditingSignatureId(null);
    setSignatureEditorName("");
    setSignatureEditorHtml("");
    setShowNewSignature(true);
    setSignatureSaved(false);
    setSignatureEditorKey((k) => k + 1);
  };

  const saveCurrentSignature = () => {
    const name = signatureEditorName().trim() || "Untitled Signature";
    const html = signatureEditorHtml().trim();
    if (!html || html === "<p><br></p>") return;

    const id = editingSignatureId();
    if (id) {
      updateSignature(id, { name, html });
    } else {
      const newId = addSignature(name, html);
      setEditingSignatureId(newId);
      setShowNewSignature(false);
    }
    setSignatureSaved(true);
    setTimeout(() => setSignatureSaved(false), 2000);
  };

  const cancelSignatureEditor = () => {
    setEditingSignatureId(null);
    setShowNewSignature(false);
    setSignatureEditorHtml("");
    setSignatureEditorName("");
  };

  const tabs = [
    { id: "general" as SettingsTab, label: "General", icon: IconInbox },
    { id: "shortcuts" as SettingsTab, label: "Keyboard Shortcuts", icon: IconBolt },
    { id: "appearance" as SettingsTab, label: "Appearance", icon: IconSparkles },
    { id: "labels" as SettingsTab, label: "Labels", icon: IconLabel },
    { id: "categories" as SettingsTab, label: "Categories", icon: IconCategories },
    { id: "signature" as SettingsTab, label: "Signature", icon: IconSignature },
    { id: "import" as SettingsTab, label: "Import", icon: IconImport },
    { id: "accounts" as SettingsTab, label: "Accounts", icon: IconMail },
    { id: "blocked" as SettingsTab, label: "Blocked Senders", icon: IconBlock },
    { id: "auto-reply" as SettingsTab, label: "Auto Reply", icon: IconSend },
  ];
  const shortcutConflictEntries = createMemo(() => Array.from(getShortcutConflictMap().entries()));
  const shortcutConflictLookup = createMemo(() => new Map(shortcutConflictEntries()));
  const isShortcutSlotConflicted = (actionId: ShortcutActionId) => {
    const shortcut = normalizeShortcut(shortcutBindings[actionId].primary);
    if (!shortcut) return false;
    return Boolean(shortcutConflictLookup().get(shortcut));
  };

  const normalizedBlockedSenders = createMemo(() =>
    (blockedSendersList() ?? []).map((sender) => ({
      ...sender,
      senderEmail: sender.senderEmail.trim().toLowerCase(),
    })),
  );
  const allBlockedSelected = createMemo(() => {
    const list = normalizedBlockedSenders();
    return list.length > 0 && list.every((sender) => selectedBlockedSenders().has(sender.senderEmail));
  });
  const selectedBlockedCount = createMemo(() => selectedBlockedSenders().size);

  const toggleBlockedSenderSelection = (senderEmail: string, checked: boolean) => {
    const key = senderEmail.trim().toLowerCase();
    setSelectedBlockedSenders((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const toggleSelectAllBlockedSenders = (checked: boolean) => {
    if (!checked) {
      setSelectedBlockedSenders(new Set());
      return;
    }
    const next = new Set(normalizedBlockedSenders().map((sender) => sender.senderEmail));
    setSelectedBlockedSenders(next);
  };
  const handleAddBlockedSender = async () => {
    const senderEmail = newBlockedSenderEmail().trim().toLowerCase();
    if (!senderEmail) {
      showToast("Sender email is required", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      showToast("Enter a valid email address", "error");
      return;
    }
    await blockSender(senderEmail, newBlockedSenderName().trim());
    setNewBlockedSenderEmail("");
    setNewBlockedSenderName("");
    setSelectedBlockedSenders(new Set());
    void refetchBlockedSenders();
    showToast(`Blocked ${senderEmail}`, "success");
  };
  const handleBatchUnblockSelected = async () => {
    const selected = Array.from(selectedBlockedSenders());
    if (!selected.length) return;
    for (const senderEmail of selected) {
      await unblockSender(senderEmail);
    }
    setSelectedBlockedSenders(new Set());
    void refetchBlockedSenders();
    showToast(`Unblocked ${selected.length} sender${selected.length === 1 ? "" : "s"}`, "success");
  };

  createEffect(() => {
    const requestedTab = searchParams.tab;
    if (requestedTab === "general" || requestedTab === "shortcuts" || requestedTab === "appearance" || requestedTab === "labels" || requestedTab === "categories" || requestedTab === "signature" || requestedTab === "import" || requestedTab === "accounts" || requestedTab === "blocked" || requestedTab === "auto-reply") {
      setActiveTab(requestedTab);
    }
  });
  createEffect(() => {
    if (activeTab() !== "shortcuts" && recordingShortcut() !== null) {
      setRecordingShortcut(null);
    }
  });
  createEffect(() => {
    const targetActionId = recordingShortcut();
    if (!targetActionId || typeof window === "undefined") return;

    const scopeName = "shortcut-recorder";
    const previousScope = hotkeys.getScope();
    const handler = (event: KeyboardEvent, hotkeysEvent: { shortcut: string }) => {
      event.preventDefault();
      event.stopPropagation();

      const key = event.key.toLowerCase();
      if (key === "escape") {
        setRecordingShortcut(null);
        return false;
      }
      if (key === "shift" || key === "control" || key === "alt" || key === "meta") return false;

      const shiftedSymbolToBase: Record<string, string> = {
        "?": "/",
        "!": "1",
        "#": "3",
      };
      const raw = event.key;
      let normalizedKey = raw.length === 1 ? raw.toLowerCase() : raw.toLowerCase();
      if (event.shiftKey && shiftedSymbolToBase[normalizedKey]) {
        normalizedKey = shiftedSymbolToBase[normalizedKey];
      }
      if (normalizedKey === "esc") normalizedKey = "escape";
      if (normalizedKey === "return") normalizedKey = "enter";
      if (normalizedKey.startsWith("arrow")) normalizedKey = normalizedKey.replace(/^arrow/, "");
      if (normalizedKey === " ") normalizedKey = "space";

      const mods: string[] = [];
      if (event.ctrlKey) mods.push("ctrl");
      if (event.altKey) mods.push("alt");
      if (event.shiftKey) mods.push("shift");
      if (event.metaKey) mods.push("meta");
      const captured = `${mods.join("+")}${mods.length > 0 ? "+" : ""}${normalizedKey}`;

      setShortcutBinding(targetActionId, normalizeShortcut(captured || hotkeysEvent.shortcut || ""));
      setRecordingShortcut(null);
      return false;
    };

    hotkeys("*", { scope: scopeName, keyup: false, keydown: true, capture: true }, handler);
    hotkeys.setScope(scopeName);

    onCleanup(() => {
      hotkeys.unbind("*", scopeName, handler);
      hotkeys.setScope(previousScope || "all");
    });
  });
  createEffect(() => {
    cacheBlockedSenderEmails((blockedSendersList() ?? []).map((sender) => sender.senderEmail));
  });
  createEffect(() => {
    const available = new Set(normalizedBlockedSenders().map((sender) => sender.senderEmail));
    setSelectedBlockedSenders((prev) => {
      const next = new Set(Array.from(prev).filter((email) => available.has(email)));
      if (next.size === prev.size) return prev;
      return next;
    });
  });

  const handleAddLabel = () => {
    const name = newLabelName().trim();
    if (!name) return;
    addLabel(name, newLabelColor());
    setNewLabelName("");
    setNewLabelColor(LABEL_COLORS[0]);
    setShowNewLabel(false);
  };

  const handleAddCategory = () => {
    const name = newCategoryName().trim();
    if (!name) return;
    const created = addCategory(name);
    if (!created) return;
    setNewCategoryName("");
  };

  const handleAddAutoRule = () => {
    const firstLabelId = visibleLabels()[0]?.id || "";
    addAutoLabelRule({
      labelId: firstLabelId,
      targetField: "destinationAddress",
      matchType: "exact",
      labelMode: "fixed",
    });
  };

  const handleAddAliasPresetRule = () => {
    addAutoLabelRule({
      targetField: "destinationAddress",
      matchType: "regex",
      pattern: "^([^+@]+)@inout\\.email$",
      labelMode: "template",
      labelTemplate: "$1",
    });
  };

  const handleAddPlusTagPresetRule = () => {
    addAutoLabelRule({
      targetField: "destinationAddress",
      matchType: "regex",
      pattern: "^[^+]+\\+label:([^@]+)@inout\\.email$",
      labelMode: "template",
      labelTemplate: "$1",
    });
  };

  const ensureLabelIdByName = (name: string): string => {
    const normalized = name.trim().toLowerCase();
    const existing = visibleLabels().find((label) => label.name.trim().toLowerCase() === normalized);
    if (existing) return existing.id;
    const color = LABEL_COLORS[visibleLabels().length % LABEL_COLORS.length];
    return addLabel(name.trim(), color);
  };

  const handleUseExampleRule = (key: "import" | "receipts" | "plusTag" | "localPart") => {
    if (key === "import") {
      addAutoLabelRule({
        targetField: "destinationAddress",
        matchType: "exact",
        pattern: "import@inout.email",
        labelMode: "fixed",
        labelId: ensureLabelIdByName("import"),
      });
      return;
    }
    if (key === "receipts") {
      addAutoLabelRule({
        targetField: "destinationAddress",
        matchType: "exact",
        pattern: "receipts@inout.email",
        labelMode: "fixed",
        labelId: ensureLabelIdByName("receipts"),
      });
      return;
    }
    if (key === "plusTag") {
      addAutoLabelRule({
        targetField: "destinationAddress",
        matchType: "regex",
        pattern: "^[^+]+\\+label:([^@]+)@inout\\.email$",
        labelMode: "template",
        labelTemplate: "$1",
      });
      return;
    }
    addAutoLabelRule({
      targetField: "destinationAddress",
      matchType: "regex",
      pattern: "^([^+@]+)@inout\\.email$",
      labelMode: "template",
      labelTemplate: "$1",
    });
  };

  const targetFieldDisplay = (field: DestinationTargetField): string => {
    if (field === "destinationAddress") return "destination address";
    if (field === "destinationLocalPart") return "destination local-part";
    return "plus-tag";
  };

  const matchTypeDisplay = (value: DestinationMatchType): string => {
    if (value === "exact") return "is exactly";
    if (value === "contains") return "contains";
    return "matches regex";
  };

  const isRegexValid = (matchType: DestinationMatchType, pattern: string, caseSensitive: boolean) => {
    if (matchType !== "regex" || !pattern.trim()) return true;
    try {
      void new RegExp(pattern, caseSensitive ? "" : "i");
      return true;
    } catch {
      return false;
    }
  };

  const parseError = async (response: Response): Promise<string> => {
    const fallback = `Request failed with status ${response.status}`;
    const contentType = (response.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.clone().json()) as { error?: string; message?: string };
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
        if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
      } catch {
        // Continue with plain-text parsing.
      }
    }

    const text = (await response.text()).trim();
    if (!text) return fallback;
    const htmlResponse = contentType.includes("text/html") || /^<!doctype html/i.test(text) || /^<html/i.test(text);
    if (htmlResponse) {
      if (response.status === 404) {
        return "Takeout import API is not available on this server yet (404). Deploy the latest webmail backend.";
      }
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch?.[1]?.trim();
      return title ? `${title} (HTTP ${response.status})` : fallback;
    }
    return text.length > 280 ? `${text.slice(0, 280)}...` : text;
  };

  const resetTakeoutAnalysis = () => {
    setTakeoutAnalysis(null);
    setTakeoutAnalysisJobId(null);
    setImportTakeoutCategories(true);
    setImportTakeoutLabels(true);
    setImportTakeoutSignatures(true);
    setImportTakeoutBlockedSenders(true);
    setTakeoutLabelPlan([]);
    setTakeoutSignaturePlan([]);
    setIncludeSentMessages(true);
    setIncludeSpamMessages(false);
    setIncludeTrashMessages(false);
  };

  const analysisMatchesCurrentJob = createMemo(() => {
    const job = takeoutJob();
    const analysis = takeoutAnalysis();
    if (!job || !analysis) return false;
    return takeoutAnalysisJobId() === job.id;
  });

  const escapeHtml = (value: string): string => {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  };

  const signatureTextToHtml = (value: string): string => {
    const escaped = escapeHtml(value.trim());
    return escaped.split(/\r?\n/).join("<br>");
  };

  const initImportPlansFromAnalysis = (analysis: TakeoutArchiveAnalysis) => {
    const labelPlan: LabelImportPlanItem[] = analysis.customLabels.map((label, idx) => ({
      sourceName: label.name,
      targetName: normalizeTargetNameForMode(label.name, label.name, extractTakeoutCategoryName(label.name) ? "category" : "label"),
      color: LABEL_COLORS[idx % LABEL_COLORS.length],
      enabled: !/^imap[_$]/i.test(label.name.trim()),
      count: label.count,
      importMode: extractTakeoutCategoryName(label.name) ? "category" : "label",
    }));
    const signaturePlan: SignatureImportPlanItem[] = analysis.signatures.map((signature) => ({
      title: signature.title || "Imported Signature",
      html: signatureTextToHtml(signature.text),
      enabled: true,
    }));
    setTakeoutLabelPlan(labelPlan);
    setTakeoutSignaturePlan(signaturePlan);
  };

  const updateLabelPlanItem = (sourceName: string, patch: Partial<LabelImportPlanItem>) => {
    setTakeoutLabelPlan((items) => items.map((item) =>
      item.sourceName === sourceName ? { ...item, ...patch } : item
    ));
  };

  const updateSignaturePlanItem = (index: number, patch: Partial<SignatureImportPlanItem>) => {
    setTakeoutSignaturePlan((items) => items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    ));
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const activeStatusRank = (status: TakeoutImportJob["status"]): number => {
    if (status === "running") return 1;
    if (status === "uploading") return 2;
    if (status === "queued") return 3;
    if (status === "created") return 4;
    return 9;
  };

  const pickBestImportJob = (jobs: TakeoutImportJob[]): TakeoutImportJob | null => {
    if (!jobs.length) return null;
    const sorted = [...jobs].sort((a, b) => {
      const rankDiff = activeStatusRank(a.status) - activeStatusRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
    return sorted[0] ?? null;
  };

  const isTakeoutAnalysis = (value: unknown): value is TakeoutArchiveAnalysis => {
    if (!value || typeof value !== "object") return false;
    const parsed = value as Record<string, unknown>;
    return typeof parsed.estimatedTotalMessages === "number" &&
      Array.isArray(parsed.customLabels) &&
      !!parsed.systemLabels &&
      typeof parsed.systemLabels === "object" &&
      Array.isArray(parsed.signatures);
  };

  const hydrateAnalysisFromJob = (job: TakeoutImportJob | null) => {
    if (!job || !job.options || !isTakeoutAnalysis(job.options.takeoutAnalysis)) {
      return;
    }
    setTakeoutAnalysis(job.options.takeoutAnalysis);
    const alreadyHydratedSameJob = takeoutAnalysisJobId() === job.id
      && (takeoutLabelPlan().length > 0 || takeoutSignaturePlan().length > 0);
    setTakeoutAnalysisJobId(job.id);
    if (!alreadyHydratedSameJob) {
      initImportPlansFromAnalysis(job.options.takeoutAnalysis);
    }
  };

  const loadLatestTakeoutJob = async () => {
    if (!takeoutJobsApiAvailable()) return;
    try {
      const response = await fetch("/api/imports/takeout/jobs");
      if (response.status === 404) {
        setTakeoutJobsApiAvailable(false);
        return;
      }
      if (!response.ok) return;
      setTakeoutJobsApiAvailable(true);
      const payload = (await response.json()) as { jobs?: TakeoutImportJob[] };
      if (payload.jobs && payload.jobs.length > 0) {
        const best = pickBestImportJob(payload.jobs);
        if (best) {
          setTakeoutJob(best);
          hydrateAnalysisFromJob(best);
          const analysisError = typeof best.options?.takeoutAnalysisError === "string" ? best.options.takeoutAnalysisError : "";
          if (analysisError) setTakeoutError(analysisError);
        }
      }
    } catch {
      // Ignore background load failures.
    }
  };

  const refreshTakeoutJob = async (id: string) => {
    const response = await fetch(`/api/imports/takeout/jobs/${id}`);
    if (response.status === 404) {
      setTakeoutJobsApiAvailable(false);
      return;
    }
    if (!response.ok) return;
    setTakeoutJobsApiAvailable(true);
    const payload = (await response.json()) as { job: TakeoutImportJob };
    setTakeoutJob(payload.job);
    hydrateAnalysisFromJob(payload.job);
  };

  const loadServerTakeoutFiles = async () => {
    setServerTakeoutFilesLoading(true);
    try {
      const response = await fetch("/api/imports/takeout/files");
      if (response.status === 404) {
        setServerTakeoutFilesUnavailable(true);
        setServerTakeoutFiles([]);
        return;
      }
      if (!response.ok) {
        setServerTakeoutFilesUnavailable(true);
        setServerTakeoutFiles([]);
        return;
      }
      const payload = (await response.json()) as { available?: boolean; files?: ServerTakeoutArchiveFile[] };
      if (payload.available === false) {
        setServerTakeoutFilesUnavailable(true);
        setServerTakeoutFiles([]);
        return;
      }
      setServerTakeoutFilesUnavailable(false);
      setServerTakeoutFiles(Array.isArray(payload.files) ? payload.files : []);
    } catch {
      setServerTakeoutFilesUnavailable(true);
      setServerTakeoutFiles([]);
    } finally {
      setServerTakeoutFilesLoading(false);
    }
  };

  createEffect(() => {
    if (activeTab() !== "import") return;
    if (!takeoutJobsApiAvailable()) return;
    if (takeoutJob()) return;
    void loadLatestTakeoutJob();
  });

  createEffect(() => {
    if (!takeoutJobsApiAvailable()) return;
    const timer = setInterval(() => {
      void loadLatestTakeoutJob();
    }, 2000);

    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    const current = takeoutJob();
    const active = !!current && ["created", "uploading", "queued", "running"].includes(current.status);
    localStorage.setItem("takeoutImportActive", active ? "true" : "false");
  });

  createEffect(() => {
    if (importSourceMode() !== "server") return;
    void loadServerTakeoutFiles();
  });

  let wasAccountsTab = false;
  createEffect(() => {
    const isAccountsTab = activeTab() === "accounts";
    if (isAccountsTab && !wasAccountsTab) {
      setProfileName(untrack(() => userName()));
      setCurrentPassword("");
      setNewPassword("");
      setTwoFactorPassword("");
      setTwoFactorSetupCode("");
      setTwoFactorSetupUri("");
      setTwoFactorQrDataUrl("");
      setBackupCodes([]);
    }
    wasAccountsTab = isAccountsTab;
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    const uri = twoFactorSetupUri();
    if (!uri) {
      setTwoFactorQrDataUrl("");
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(uri, {
      width: 224,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (!cancelled) setTwoFactorQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setTwoFactorQrDataUrl("");
      });

    onCleanup(() => {
      cancelled = true;
    });
  });

  const parseOtpSecret = (uri: string): string => {
    if (!uri) return "";
    try {
      const parsed = new URL(uri);
      return parsed.searchParams.get("secret") || "";
    } catch {
      return "";
    }
  };

  const downloadBackupCodes = () => {
    const codes = backupCodes();
    if (!codes.length) return;

    const text = [
      "Homerow backup codes",
      "",
      ...codes.map((code, index) => `${index + 1}. ${code}`),
      "",
      "Each backup code can be used once.",
      "Store these in a secure password manager.",
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "homerow-backup-codes.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const prepareUploadTakeoutJob = async (): Promise<TakeoutImportJob> => {
    const file = selectedTakeoutFile();
    if (!file) throw new Error("Choose a Takeout archive first.");

    const current = takeoutJob();
    const canReuseCurrentJob = !!current &&
      ["created", "uploading"].includes(current.status) &&
      current.sourceFilename === file.name &&
      current.fileSizeBytes === file.size;

    let job: TakeoutImportJob;
    if (canReuseCurrentJob) {
      await refreshTakeoutJob(current!.id);
      const latest = takeoutJob();
      if (!latest) throw new Error("Could not reload current import job.");
      job = latest;
    } else {
      const createJobResponse = await fetch("/api/imports/takeout/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSizeBytes: file.size,
          options: { duplicatePolicy: "resume" },
        }),
      });

      if (!createJobResponse.ok) {
        throw new Error(await parseError(createJobResponse));
      }

      const createdPayload = (await createJobResponse.json()) as { job: TakeoutImportJob };
      job = createdPayload.job;
      setTakeoutJob(job);
    }

    const uploadChunkWithRetry = async (jobId: string, chunk: Blob, offset: number): Promise<TakeoutImportJob> => {
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          const formData = new FormData();
          formData.append("chunk", chunk, file.name);
          formData.append("offset", String(offset));

          const chunkResponse = await fetch(`/api/imports/takeout/jobs/${jobId}/chunks`, {
            method: "POST",
            body: formData,
          });

          if (!chunkResponse.ok) {
            throw new Error(await parseError(chunkResponse));
          }

          const payload = (await chunkResponse.json()) as { job?: TakeoutImportJob | null };
          if (!payload.job) throw new Error("Upload chunk succeeded but job state was not returned.");
          return payload.job;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Chunk upload failed.");
          if (attempt < 4) {
            await sleep(500 * attempt);
            continue;
          }
        }
      }
      throw lastError ?? new Error("Upload failed.");
    };

    const chunkSize = 2 * 1024 * 1024;
    let offset = Math.min(job.uploadedBytes || 0, file.size);
    setTakeoutUploadPercent(Math.min(100, Math.round((offset / file.size) * 100)));

    while (offset < file.size) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const updatedJob = await uploadChunkWithRetry(job.id, chunk, offset);
      job = updatedJob;
      setTakeoutJob(updatedJob);
      offset = Math.max(offset + chunk.size, updatedJob.uploadedBytes);
      setTakeoutUploadPercent(Math.min(100, Math.round((offset / file.size) * 100)));
    }

    return job;
  };

  const prepareServerTakeoutJob = async (): Promise<TakeoutImportJob> => {
    const filename = serverTakeoutFilename().trim();
    if (!filename) {
      throw new Error("Enter a server filename, for example your-archive.tgz");
    }
    const lower = filename.toLowerCase();
    if (!lower.endsWith(".tgz") && !lower.endsWith(".tar.gz")) {
      throw new Error("Server filename must end with .tgz or .tar.gz");
    }

    const createJobResponse = await fetch("/api/imports/takeout/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        existingServerFilename: filename,
        filename,
        deleteServerFileAfterImport: deleteServerFileAfterImport(),
        options: { duplicatePolicy: "resume" },
      }),
    });
    if (!createJobResponse.ok) throw new Error(await parseError(createJobResponse));

    const createdPayload = (await createJobResponse.json()) as { job: TakeoutImportJob };
    const createdJob = createdPayload.job;
    setTakeoutJob(createdJob);
    return createdJob;
  };

  const analyzeTakeoutJob = async (jobId: string): Promise<TakeoutArchiveAnalysis | null> => {
    const response = await fetch(`/api/imports/takeout/jobs/${jobId}/analyze`, { method: "POST" });
    if (!response.ok) throw new Error(await parseError(response));
    const payload = (await response.json()) as { analysis?: TakeoutArchiveAnalysis; job?: TakeoutImportJob };
    if (payload.job) setTakeoutJob(payload.job);
    return payload.analysis ?? null;
  };

  const runTakeoutArchiveAnalysis = async () => {
    if (takeoutBusy() || takeoutAnalysisBusy()) return;
    setTakeoutError(null);
    setTakeoutBusy(true);
    setTakeoutAnalysisBusy(true);
    setTakeoutUploadPercent(0);
    resetTakeoutAnalysis();

    try {
      const preparedJob = importSourceMode() === "server"
        ? await prepareServerTakeoutJob()
        : await prepareUploadTakeoutJob();

      const immediateAnalysis = await analyzeTakeoutJob(preparedJob.id);
      if (immediateAnalysis) {
        setTakeoutAnalysis(immediateAnalysis);
        setTakeoutAnalysisJobId(preparedJob.id);
        initImportPlansFromAnalysis(immediateAnalysis);
      } else {
        const maxWaitMs = 60 * 60 * 1000;
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
          await sleep(1500);
          await refreshTakeoutJob(preparedJob.id);
          const current = takeoutJob();
          if (current?.options?.takeoutAnalysis && isTakeoutAnalysis(current.options.takeoutAnalysis)) {
            setTakeoutAnalysis(current.options.takeoutAnalysis);
            setTakeoutAnalysisJobId(preparedJob.id);
            initImportPlansFromAnalysis(current.options.takeoutAnalysis);
            break;
          }
          const analysisError = typeof current?.options?.takeoutAnalysisError === "string"
            ? current.options.takeoutAnalysisError
            : "";
          if (analysisError) throw new Error(analysisError);
        }
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Archive analysis failed.";
      const message = rawMessage.includes("Failed to fetch")
        ? "Network interrupted during upload. Click analyze again to resume from the last uploaded chunk."
        : rawMessage;
      setTakeoutError(message);
    } finally {
      setTakeoutBusy(false);
      setTakeoutAnalysisBusy(false);
    }
  };

  const importLabelsAndSignaturesFromAnalysis = async () => {
    if (importTakeoutCategories()) {
      const existingCategoryKeys = new Set(configuredCategories().map((category) => category.key));
      for (const item of takeoutCategoryPlan()) {
        if (!item.enabled) continue;
        const targetName = item.targetName.trim();
        const categoryName = targetName || extractTakeoutCategoryName(item.sourceName) || item.sourceName;
        const categoryKey = normalizeCategoryNameToKey(categoryName);
        if (!categoryKey || existingCategoryKeys.has(categoryKey)) continue;
        addCategory(categoryName);
        existingCategoryKeys.add(categoryKey);
      }
    }

    if (importTakeoutLabels()) {
      const existingLabelNames = new Set(visibleLabels().map((label) => label.name.trim().toLowerCase()));
      for (const item of takeoutCustomLabelPlan()) {
        if (!item.enabled) continue;
        const targetName = item.targetName.trim();
        const normalized = targetName.toLowerCase();
        if (!normalized || existingLabelNames.has(normalized)) continue;
        addLabel(targetName, item.color);
        existingLabelNames.add(normalized);
      }
    }

    if (importTakeoutSignatures()) {
      const existingSignatures = new Set(
        signatureState.signatures.map((sig) => `${sig.name.trim().toLowerCase()}::${sig.html.trim()}`),
      );
      for (const signature of takeoutSignaturePlan()) {
        if (!signature.enabled) continue;
        const name = signature.title.trim() || "Imported Signature";
        const html = signature.html.trim();
        const key = `${name.toLowerCase()}::${html.trim()}`;
        if (!html.trim() || existingSignatures.has(key)) continue;
        addSignature(name, html);
        existingSignatures.add(key);
      }
    }

    const analyzedBlocked = importTakeoutBlockedSenders() && Array.isArray(takeoutAnalysis()?.blockedSenders)
      ? takeoutAnalysis()!.blockedSenders
      : [];
    if (analyzedBlocked.length > 0) {
      const alreadyBlocked = new Set(
        (blockedSendersList() ?? []).map((sender) => sender.senderEmail.trim().toLowerCase()),
      );
      for (const sender of analyzedBlocked) {
        const normalized = typeof sender === "string" ? sender.trim().toLowerCase() : "";
        if (!normalized || alreadyBlocked.has(normalized)) continue;
        await blockSender(normalized, normalized);
        alreadyBlocked.add(normalized);
      }
      await refetchBlockedSenders();
    }
  };

  const startAnalyzedTakeoutImport = async () => {
    const job = takeoutJob();
    if (!job) {
      setTakeoutError("Analyze an archive first.");
      return;
    }
    if (!analysisMatchesCurrentJob()) {
      setTakeoutError("Run archive analysis before starting the import.");
      return;
    }

    setTakeoutError(null);
    setTakeoutBusy(true);

    try {
      await importLabelsAndSignaturesFromAnalysis();

      const completeResponse = await fetch(`/api/imports/takeout/jobs/${job.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: {
            duplicatePolicy: "resume",
            importLabelsFromTakeout: importTakeoutLabels() || importTakeoutCategories(),
            importSignaturesFromTakeout: importTakeoutSignatures(),
            importBlockedSendersFromTakeout: importTakeoutBlockedSenders(),
            includeSentMessages: includeSentMessages(),
            includeSpamMessages: includeSpamMessages(),
            includeTrashMessages: includeTrashMessages(),
            importLabelMappings: takeoutLabelPlan().map((item) => ({
              sourceName: item.sourceName,
              targetName: toTakeoutMappingTargetName(item),
              enabled: item.enabled,
              color: item.color,
            })),
          },
        }),
      });
      if (!completeResponse.ok) {
        throw new Error(await parseError(completeResponse));
      }

      const queuedPayload = (await completeResponse.json()) as { job: TakeoutImportJob };
      setTakeoutJob(queuedPayload.job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start import.";
      setTakeoutError(message);
    } finally {
      setTakeoutBusy(false);
    }
  };

  const cancelTakeoutImport = async () => {
    const job = takeoutJob();
    if (!job) return;

    setTakeoutBusy(true);
    setTakeoutError(null);
    try {
      const response = await fetch(`/api/imports/takeout/jobs/${job.id}/cancel`, { method: "POST" });
      if (!response.ok) throw new Error(await parseError(response));
      const payload = (await response.json()) as { job: TakeoutImportJob };
      setTakeoutJob(payload.job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not cancel import.";
      setTakeoutError(message);
    } finally {
      setTakeoutBusy(false);
    }
  };

  const saveProfileName = async () => {
    const name = profileName().trim();
    if (!name) {
      showToast("Display name cannot be empty", "error");
      return;
    }
    setAccountBusy("name");
    try {
      const { error } = await authClient.updateUser({ name });
      if (error) {
        showToast(error.message || "Could not update display name", "error");
        return;
      }
      showToast("Display name updated", "success");
    } catch {
      showToast("Could not update display name", "error");
    } finally {
      setAccountBusy(null);
    }
  };

  const changePassword = async () => {
    if (!currentPassword() || !newPassword()) {
      showToast("Fill current and new password", "error");
      return;
    }
    if (newPassword().length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }
    setAccountBusy("password");
    try {
      const { error } = await authClient.changePassword({
        currentPassword: currentPassword(),
        newPassword: newPassword(),
        revokeOtherSessions: true,
      });
      if (error) {
        showToast(error.message || "Could not update password", "error");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      showToast("Webmail login password updated", "success");
    } catch {
      showToast("Could not update password", "error");
    } finally {
      setAccountBusy(null);
    }
  };

  const startTwoFactorSetup = async () => {
    if (!twoFactorPassword()) {
      showToast("Enter your current password to enable 2FA", "error");
      return;
    }

    setAccountBusy("twoFactor");
    try {
      const result = await authClient.twoFactor.enable({
        password: twoFactorPassword(),
        issuer: "Homerow",
      });
      if (result.error) {
        showToast(result.error.message || "Could not start two-factor setup", "error");
        return;
      }

      const payload = result.data as { totpURI?: string; backupCodes?: string[] } | undefined;
      setTwoFactorSetupUri(payload?.totpURI || "");
      setBackupCodes(payload?.backupCodes || []);
      setTwoFactorSetupCode("");
      showToast("Authenticator setup started. Verify with a code to finish.", "success");
    } catch {
      showToast("Could not start two-factor setup", "error");
    } finally {
      setAccountBusy(null);
    }
  };

  const finishTwoFactorSetup = async () => {
    const code = twoFactorSetupCode().trim();
    if (!code) {
      showToast("Enter a code from your authenticator app", "error");
      return;
    }

    setAccountBusy("twoFactor");
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: false,
      });
      if (result.error) {
        showToast(result.error.message || "Invalid authenticator code", "error");
        return;
      }

      setTwoFactorSetupCode("");
      setTwoFactorSetupUri("");
      showToast("Two-factor authentication enabled", "success");
    } catch {
      showToast("Could not verify authenticator code", "error");
    } finally {
      setAccountBusy(null);
    }
  };

  const disableTwoFactor = async () => {
    if (!twoFactorPassword()) {
      showToast("Enter your current password to disable 2FA", "error");
      return;
    }

    setAccountBusy("twoFactor");
    try {
      const result = await authClient.twoFactor.disable({
        password: twoFactorPassword(),
      });
      if (result.error) {
        showToast(result.error.message || "Could not disable two-factor auth", "error");
        return;
      }

      setTwoFactorSetupCode("");
      setTwoFactorSetupUri("");
      setBackupCodes([]);
      showToast("Two-factor authentication disabled", "success");
    } catch {
      showToast("Could not disable two-factor auth", "error");
    } finally {
      setAccountBusy(null);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!twoFactorPassword()) {
      showToast("Enter your current password to regenerate backup codes", "error");
      return;
    }

    setAccountBusy("twoFactor");
    try {
      const result = await authClient.twoFactor.generateBackupCodes({
        password: twoFactorPassword(),
      });
      if (result.error) {
        showToast(result.error.message || "Could not regenerate backup codes", "error");
        return;
      }

      const payload = result.data as { backupCodes?: string[] } | undefined;
      setBackupCodes(payload?.backupCodes || []);
      showToast("Generated new backup codes", "success");
    } catch {
      showToast("Could not regenerate backup codes", "error");
    } finally {
      setAccountBusy(null);
    }
  };

  const onSelectProfileImage = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "error");
      input.value = "";
      return;
    }
    void (async () => {
      setAccountBusy("avatar");
      try {
        const optimizeAvatarFile = async (source: File): Promise<Blob> => {
          if (!source.type.startsWith("image/")) return source;
          if (source.type === "image/gif" && source.size <= MAX_AVATAR_UPLOAD_BYTES) return source;

          const bitmap = await createImageBitmap(source);
          const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
          const width = Math.max(1, Math.round(bitmap.width * scale));
          const height = Math.max(1, Math.round(bitmap.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not process image");
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();

          const encodeWebp = (quality: number) =>
            new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
          const encodeJpeg = (quality: number) =>
            new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

          let quality = 0.86;
          let optimized = await encodeWebp(quality);
          while (optimized && optimized.size > MAX_AVATAR_UPLOAD_BYTES && quality > 0.45) {
            quality -= 0.1;
            optimized = await encodeWebp(quality);
          }

          if (!optimized || optimized.size > MAX_AVATAR_UPLOAD_BYTES) {
            quality = 0.82;
            optimized = await encodeJpeg(quality);
            while (optimized && optimized.size > MAX_AVATAR_UPLOAD_BYTES && quality > 0.45) {
              quality -= 0.1;
              optimized = await encodeJpeg(quality);
            }
          }

          if (!optimized || optimized.size > MAX_AVATAR_UPLOAD_BYTES) {
            throw new Error("Image is too large even after compression. Try a smaller image.");
          }

          return optimized;
        };

        const previousImage = userImage();
        const optimizedAvatar = await optimizeAvatarFile(file);
        const formData = new FormData();
        const preferredName = (file.name || "avatar").replace(/\.[^.]+$/, "");
        const extension =
          optimizedAvatar.type === "image/jpeg"
            ? "jpg"
            : optimizedAvatar.type === "image/webp"
              ? "webp"
              : optimizedAvatar.type === "image/png"
                ? "png"
                : optimizedAvatar.type === "image/gif"
                  ? "gif"
                  : "webp";
        formData.append("avatar", optimizedAvatar, `${preferredName}.${extension}`);

        const uploadResponse = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(await parseError(uploadResponse));
        }

        const payload = (await uploadResponse.json()) as { url?: string };
        if (!payload.url) throw new Error("Upload completed but no image URL was returned.");

        const { error } = await authClient.updateUser({ image: payload.url });
        if (error) {
          throw new Error(error.message || "Could not save profile picture.");
        }

        if (previousImage) {
          await fetch("/api/profile/avatar", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: previousImage }),
          });
        }

        showToast("Profile picture updated", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Could not upload image", "error");
      } finally {
        input.value = "";
        setAccountBusy(null);
      }
    })();
  };

  const removeProfileImage = () => {
    void (async () => {
      const previousImage = userImage();
      setAccountBusy("avatar");
      try {
        const { error } = await authClient.updateUser({ image: null });
        if (error) {
          throw new Error(error.message || "Could not remove profile picture.");
        }

        if (previousImage) {
          await fetch("/api/profile/avatar", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: previousImage }),
          });
        }

        showToast("Profile picture removed", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Could not remove profile picture", "error");
      } finally {
        setAccountBusy(null);
      }
    })();
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const importProgressPercent = () => {
    const job = takeoutJob();
    if (!job || !job.estimatedTotalMessages || job.estimatedTotalMessages <= 0) return null;
    const inDbPhase = job.status === "running" && job.processedMessages < job.estimatedTotalMessages;
    if (inDbPhase) {
      return Math.min(100, Math.round((job.processedMessages / job.estimatedTotalMessages) * 100));
    }
    const syncTarget = Math.max(1, job.dbImportedMessages || 1);
    return Math.min(100, Math.round((job.imapSyncedMessages / syncTarget) * 100));
  };

  const estimationProgressPercent = () => {
    const job = takeoutJob();
    if (!job || !job.estimationInProgress || job.estimationTotalBytes <= 0) return null;
    return Math.min(100, Math.round((job.estimationScannedBytes / job.estimationTotalBytes) * 100));
  };

  const importEtaLabel = () => {
    const job = takeoutJob();
    if (!job) return null;
    if (job.status !== "running" || job.estimationInProgress) return null;
    if (!job.estimatedTotalMessages || job.estimatedTotalMessages <= 0) return null;
    if (!job.startedAt) return null;
    const elapsedSec = (Date.now() - Date.parse(job.startedAt)) / 1000;
    const inDbPhase = job.processedMessages < job.estimatedTotalMessages;
    const done = inDbPhase ? job.processedMessages : job.imapSyncedMessages;
    if (!Number.isFinite(elapsedSec) || elapsedSec < 20 || done < 20) return null;
    const rate = done / elapsedSec;
    if (!Number.isFinite(rate) || rate <= 0.05) return null;
    const target = inDbPhase ? job.estimatedTotalMessages : Math.max(1, job.dbImportedMessages || 1);
    const remaining = Math.max(0, target - done);
    const etaSec = remaining / rate;
    if (etaSec < 60) return `${Math.max(1, Math.round(etaSec))}s`;
    if (etaSec < 3600) return `${Math.round(etaSec / 60)}m`;
    const h = Math.floor(etaSec / 3600);
    const m = Math.round((etaSec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const importPhaseLabel = () => {
    const job = takeoutJob();
    if (!job) return "Import progress";
    if (job.status !== "running") return "Import progress";
    if (job.estimatedTotalMessages && job.processedMessages < job.estimatedTotalMessages) {
      return "DB ingest progress";
    }
    if (job.imapSyncedMessages < job.dbImportedMessages) {
      return "IMAP sync progress";
    }
    return "Import progress";
  };

  const importProgressDetail = () => {
    const job = takeoutJob();
    if (!job) return "";
    if (job.status === "running" && job.estimatedTotalMessages && job.processedMessages < job.estimatedTotalMessages) {
      return `${job.processedMessages}/${job.estimatedTotalMessages}`;
    }
    return `${job.imapSyncedMessages}/${Math.max(1, job.dbImportedMessages || 1)}`;
  };

  const takeoutArchivePartCount = () => {
    const job = takeoutJob();
    if (!job) return 1;
    const raw = job.options?.archiveParts;
    if (!Array.isArray(raw) || raw.length === 0) return 1;
    let count = 0;
    for (const part of raw) {
      if (!part || typeof part !== "object") continue;
      const value = part as Record<string, unknown>;
      if (typeof value.tempFilePath === "string" && value.tempFilePath.trim()) count += 1;
    }
    return Math.max(1, count);
  };

  const activeImportStatuses: TakeoutImportJob["status"][] = ["created", "uploading", "queued", "running"];

  const importStatusStyle = (status: TakeoutImportJob["status"]) => {
    if (status === "completed") return "text-[#34a853] bg-[#34a853]/10";
    if (status === "failed" || status === "cancelled") return "text-[var(--destructive)] bg-red-50";
    return "text-[var(--primary)] bg-[var(--active-bg)]";
  };

  const canResumeCurrentUpload = () => {
    const file = selectedTakeoutFile();
    const job = takeoutJob();
    if (!file || !job) return false;
    return ["created", "uploading"].includes(job.status) &&
      job.sourceFilename === file.name &&
      job.fileSizeBytes === file.size &&
      job.uploadedBytes > 0 &&
      job.uploadedBytes < job.fileSizeBytes;
  };

  const handleClearLocalMailCache = async () => {
    if (clearingCache()) return;
    const confirmed = typeof window === "undefined" ? true : window.confirm("Clear local mail cache? Prefetched pages will be re-downloaded as needed.");
    if (!confirmed) return;
    setClearingCache(true);
    try {
      await clearPaginationCache();
      setCacheStats({ pages: 0, bytes: 0 });
      showToast("Local mail cache cleared", "success");
    } catch {
      showToast("Could not clear local mail cache", "error");
    } finally {
      setClearingCache(false);
      void refreshLocalCacheStats();
    }
  };

  const refreshLocalCacheStats = async () => {
    setLoadingCacheStats(true);
    try {
      const stats = await getPaginationCacheStats();
      setCacheStats(stats);
    } catch {
      setCacheStats(null);
    } finally {
      setLoadingCacheStats(false);
    }
  };

  createEffect(() => {
    if (activeTab() !== "general") return;
    void refreshLocalCacheStats();
    void refetchUpdateStatus();
  });

  onMount(() => {
    void refetchUpdateStatus();
  });

  return (
    <div class="flex flex-col flex-1 h-full bg-[var(--card)]">
      {/* Header */}
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-light)] shrink-0">
        <A
          href="/"
          class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] no-underline"
        >
          <IconBack size={18} />
        </A>
        <h1 class="text-lg font-semibold text-[var(--foreground)]">Settings</h1>
      </div>

      <div class="flex flex-1 min-h-0">
        {/* Tabs sidebar */}
        <div class="w-56 border-r border-[var(--border-light)] p-3 flex flex-col gap-0.5 shrink-0">
          <For each={tabs}>
            {(tab) => (
              <button
                data-testid={`settings-tab-${tab.id}`}
                class={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium border-none cursor-pointer transition-all w-full text-left ${
                  activeTab() === tab.id
                    ? "bg-[var(--active-bg)] text-[var(--primary)] font-semibold"
                    : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span data-testid={`settings-tab-icon-${tab.id}`}>
                  <tab.icon size={18} />
                </span>
                {tab.label}
              </button>
            )}
          </For>
        </div>

        {/* Tab Content */}
        <div class="flex-1 overflow-y-auto p-8 max-w-3xl">
          <Show when={activeTab() === "general"}>
            <div class="flex flex-col gap-8">
              <h2 class="text-xl font-semibold text-[var(--foreground)]">General Settings</h2>

              <Show when={updateStatus()?.updateAvailable}>
                <div data-testid="settings-update-card" class="flex items-start justify-between gap-4 p-4 rounded-xl border border-[#f2d091] bg-gradient-to-r from-[#fff8e6] to-[#fffdf4]">
                  <div class="flex flex-col gap-1">
                    <span class="text-sm font-semibold text-[#7a5500]">Update available</span>
                    <span class="text-xs text-[#7a5500]">
                      {`Installed ${updateStatus()?.installed ?? "unknown"} · Latest ${updateStatus()?.latest ?? "unknown"} · Channel ${updateStatus()?.sourceLabel ?? "Upstream"}`}
                    </span>
                  </div>
                  <a
                    href={updateStatus()?.releaseUrl || "https://github.com/guilhermeprokisch/homerow/releases"}
                    target="_blank"
                    rel="noreferrer"
                    class="px-3 py-1.5 rounded-md text-xs font-semibold text-[#7a5500] bg-white border border-[#efd8a0] no-underline hover:bg-[#fffef9]"
                  >
                    View changelog
                  </a>
                </div>
              </Show>

              {/* Display density */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Display density</label>
                <p class="text-xs text-[var(--text-muted)]">Choose how much information to display in each row</p>
                <div class="flex gap-3 mt-1">
                  {(["compact", "default", "comfortable"] as const).map(d => (
                    <button
                      class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                        settings.density === d
                          ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                          : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                      }`}
                      onClick={() => setSettings("density", d)}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reading pane position */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Reading pane position</label>
                <p class="text-xs text-[var(--text-muted)]">Choose where to display the reading pane</p>
                <div class="flex gap-3 mt-1">
                  {(["right", "bottom", "none"] as const).map(p => (
                    <button
                      class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                        settings.readingPane === p
                          ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                          : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                      }`}
                      onClick={() => setSettings("readingPane", p)}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation view */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Conversation view</label>
                <p class="text-xs text-[var(--text-muted)]">Group emails from the same conversation together, like Gmail threads</p>
                <div class="flex gap-3 mt-1">
                  <button
                    class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                      settings.conversationView
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("conversationView", true)}
                  >
                    On
                  </button>
                  <button
                    class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                      !settings.conversationView
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("conversationView", false)}
                  >
                    Off
                  </button>
                </div>
              </div>

              {/* Theme shortcut */}
              <div class="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--search-bg)]">
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold text-[var(--foreground)]">Theme</span>
                  <span class="text-xs text-[var(--text-muted)]">Currently using <span class="font-medium text-[var(--primary)]">{THEMES[settings.theme].name}</span></span>
                </div>
                <button
                  onClick={() => setActiveTab("appearance")}
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:brightness-110 transition-all cursor-pointer border-none"
                >
                  Change theme
                </button>
              </div>

              {/* Auto advance */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Auto-advance</label>
                <p class="text-xs text-[var(--text-muted)]">After archiving or deleting, go to:</p>
                <select
                  value={settings.autoAdvance}
                  onChange={(e) => setSettings("autoAdvance", e.currentTarget.value as any)}
                  class="w-48 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none cursor-pointer"
                >
                  <option value="next">Next conversation</option>
                  <option value="previous">Previous conversation</option>
                  <option value="list">Back to list</option>
                </select>
              </div>

              {/* Emails per page */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Emails per page</label>
                <select
                  value={settings.emailsPerPage}
                  onChange={(e) => setSettings("emailsPerPage", e.currentTarget.value)}
                  class="w-48 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none cursor-pointer"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              {/* Desktop notifications */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Desktop notifications</label>
                <p class="text-xs text-[var(--text-muted)]">Show browser notifications when new emails arrive (even when the tab is in background)</p>
                <div class="flex gap-3 mt-1">
                  <button
                    class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                      settings.notifications
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("notifications", true)}
                  >
                    On
                  </button>
                  <button
                    class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                      !settings.notifications
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("notifications", false)}
                  >
                    Off
                  </button>
                </div>
              </div>

              {/* Update notifications */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Update notifications</label>
                <p class="text-xs text-[var(--text-muted)]">Show update indicators in the Homerow links menu and account toolbar.</p>
                <div class="flex gap-3 mt-1">
                  <button
                    data-testid="settings-update-notifications-on"
                    class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                      settings.updateNotifications
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("updateNotifications", true)}
                  >
                    On
                  </button>
                  <button
                    data-testid="settings-update-notifications-off"
                    class={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                      !settings.updateNotifications
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("updateNotifications", false)}
                  >
                    Off
                  </button>
                </div>
              </div>

              {/* Local cache */}
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold text-[var(--foreground)]">Local cache</label>
                <p class="text-xs text-[var(--text-muted)]">Remove prefetched pages stored on this device.</p>
                <p class="text-xs text-[var(--text-muted)]">
                  <Show
                    when={!loadingCacheStats()}
                    fallback={"Checking cache size..."}
                  >
                    {`${cacheStats()?.pages ?? 0} cached pages (${formatBytes(cacheStats()?.bytes ?? 0)})`}
                  </Show>
                </p>
                <div class="mt-1">
                  <button
                    onClick={() => void handleClearLocalMailCache()}
                    disabled={clearingCache()}
                    class="px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {clearingCache() ? "Clearing..." : "Clear local mail cache"}
                  </button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "shortcuts"}>
            <div class="flex flex-col gap-8">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-xl font-semibold text-[var(--foreground)]">Keyboard Shortcuts</h2>
                  <p class="text-sm text-[var(--text-muted)] mt-1">
                    Customize shortcut mappings with one key mapping per action.
                  </p>
                </div>
                <button
                  data-testid="shortcuts-restore-defaults"
                  onClick={restoreDefaultShortcuts}
                  class="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-all cursor-pointer"
                >
                  Restore defaults
                </button>
              </div>

              <div class="text-xs text-[var(--text-muted)] -mt-3">
                Use plain keys like <span class="font-mono">j</span>, combos like <span class="font-mono">ctrl+enter</span>, or chords like <span class="font-mono">g i</span>.
              </div>

              <div class="flex items-center justify-between rounded-xl border border-[var(--border-light)] px-4 py-3 bg-[var(--search-bg)]">
                <div class="text-sm text-[var(--foreground)] font-medium">Show pressed key and action feedback</div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    data-testid="shortcut-feedback-on"
                    class={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                      settings.shortcutFeedback
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("shortcutFeedback", true)}
                  >
                    On
                  </button>
                  <button
                    type="button"
                    data-testid="shortcut-feedback-off"
                    class={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                      !settings.shortcutFeedback
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("shortcutFeedback", false)}
                  >
                    Off
                  </button>
                </div>
              </div>

              <Show when={shortcutConflictEntries().length > 0}>
                <div data-testid="shortcut-conflict-warning" class="rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
                  Conflicting shortcuts detected. Conflicting bindings are ignored until resolved.
                </div>
              </Show>

              <For each={["Navigation", "Actions", "Compose", "Go to", "Search & Help"] as const}>
                {(section) => (
                  <div class="flex flex-col gap-3">
                    <h3 class="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {section}
                    </h3>

                    <For each={SHORTCUT_ACTIONS.filter((action) => action.section === section)}>
                      {(action) => (
                        <div class="grid grid-cols-[minmax(180px,1fr)_360px] gap-3 items-center p-3 rounded-xl border border-[var(--border-light)] bg-[var(--search-bg)]">
                          <div class="min-w-0 text-sm font-semibold text-[var(--foreground)]">{action.label}</div>
                          <div class="flex items-center gap-2">
                            <input
                              data-testid={`shortcut-input-${action.id}-primary`}
                              data-conflict={isShortcutSlotConflicted(action.id) ? "true" : "false"}
                              value={shortcutBindings[action.id].primary}
                              onInput={(e) => setShortcutBinding(action.id, e.currentTarget.value)}
                              placeholder={formatShortcut(action.defaultPrimary)}
                              class={`h-9 flex-1 px-3 rounded-lg border bg-[var(--card)] text-sm text-[var(--foreground)] outline-none ${
                                isShortcutSlotConflicted(action.id)
                                  ? "border-red-400 focus:border-red-500"
                                  : "border-[var(--border)] focus:border-[var(--primary)]"
                              }`}
                            />
                            <button
                              type="button"
                              data-testid={`shortcut-record-${action.id}-primary`}
                              onClick={() => setRecordingShortcut(action.id)}
                              class={`h-9 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                                recordingShortcut() === action.id
                                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                                  : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                              }`}
                            >
                              {recordingShortcut() === action.id ? "Press keys..." : "Set"}
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={activeTab() === "appearance"}>
            <div class="flex flex-col gap-8">
              <div>
                <h2 class="text-xl font-semibold text-[var(--foreground)]">Appearance</h2>
                <p class="text-sm text-[var(--text-muted)] mt-1">Customize the look and feel of your inbox — themes, colors, and typography.</p>
              </div>

              {/* Font */}
              <div class="flex flex-col gap-3">
                <div>
                  <label class="text-sm font-semibold text-[var(--foreground)]">Font</label>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">Choose the typeface used throughout the interface</p>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  {(Object.keys(FONTS) as FontId[]).map(id => {
                    const f = FONTS[id];
                    const isActive = settings.font === id;
                    return (
                      <button
                        class={`flex flex-col gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                          isActive
                            ? "border-[var(--primary)] bg-[var(--active-bg)]"
                            : "border-[var(--border)] bg-transparent hover:bg-[var(--hover-bg)]"
                        }`}
                        onClick={() => setSettings("font", id)}
                      >
                        <span
                          class="text-xl font-medium leading-tight text-[var(--foreground)]"
                          style={{ "font-family": f.family }}
                        >
                          Aa
                        </span>
                        <div class="flex flex-col gap-0.5">
                          <span class={`text-sm font-semibold ${isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                            {f.name}
                          </span>
                          <span class="text-xs text-[var(--text-muted)] truncate" style={{ "font-family": f.family }}>
                            {f.previewText}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div class="border-t border-[var(--border-light)]" />

              {/* Themes */}
              <div class="flex flex-col gap-1">
                <label class="text-sm font-semibold text-[var(--foreground)]">Theme</label>
                <p class="text-xs text-[var(--text-muted)]">Choose a visual style for your inbox</p>
              </div>

              {/* Light themes */}
              <div class="flex flex-col gap-3">
                <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Light</span>
                <div class="grid grid-cols-3 gap-3">
                  {(Object.keys(THEMES) as ThemeId[]).filter(id => !THEMES[id].isDark).map(id => {
                    const t = THEMES[id];
                    const isActive = settings.theme === id;
                    return (
                      <button
                        class={`flex flex-col gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                          isActive
                            ? "border-[var(--primary)] bg-[var(--active-bg)]"
                            : "border-[var(--border)] bg-transparent hover:bg-[var(--hover-bg)]"
                        }`}
                        onClick={() => setSettings("theme", id)}
                      >
                        {/* Rich preview */}
                        <div class="w-full h-20 rounded-xl overflow-hidden flex shadow-sm" style={{ background: t.vars.background }}>
                          {/* Sidebar */}
                          <div class="w-8 h-full shrink-0 flex flex-col pt-2 px-1 gap-1" style={{ background: t.vars.sidebar, "border-right": `1px solid ${t.vars.sidebarBorder}` }}>
                            <div class="rounded h-1.5 w-full" style={{ background: t.vars.primary, opacity: "0.8" }} />
                            <div class="rounded h-1.5 w-4/5" style={{ background: t.vars.sidebarForeground, opacity: "0.2" }} />
                            <div class="rounded h-1.5 w-4/5" style={{ background: t.vars.sidebarForeground, opacity: "0.2" }} />
                          </div>
                          {/* Email list */}
                          <div class="flex-1 flex flex-col gap-1 p-2">
                            <div class="flex gap-1.5 items-center">
                              <div class="rounded-full h-2 w-2 shrink-0" style={{ background: t.vars.primary }} />
                              <div class="rounded h-1.5 flex-1" style={{ background: t.vars.foreground, opacity: "0.3" }} />
                            </div>
                            <div class="flex gap-1.5 items-center">
                              <div class="rounded-full h-2 w-2 shrink-0" style={{ background: t.vars.foreground, opacity: "0.1" }} />
                              <div class="rounded h-1.5 w-3/4" style={{ background: t.vars.foreground, opacity: "0.15" }} />
                            </div>
                            <div class="flex gap-1.5 items-center">
                              <div class="rounded-full h-2 w-2 shrink-0" style={{ background: t.vars.foreground, opacity: "0.1" }} />
                              <div class="rounded h-1.5 w-2/3" style={{ background: t.vars.foreground, opacity: "0.12" }} />
                            </div>
                          </div>
                        </div>
                        {/* Color palette strip */}
                        <div class="flex gap-1 px-0.5">
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.background }} />
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.card }} />
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.primary }} />
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.accent }} />
                        </div>
                        <div class="flex items-center justify-between">
                          <span class={`text-sm font-semibold ${isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>{t.name}</span>
                          {isActive && (
                            <div class="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: t.vars.primary }}>
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dark themes */}
              <div class="flex flex-col gap-3">
                <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Dark</span>
                <div class="grid grid-cols-3 gap-3">
                  {(Object.keys(THEMES) as ThemeId[]).filter(id => THEMES[id].isDark).map(id => {
                    const t = THEMES[id];
                    const isActive = settings.theme === id;
                    return (
                      <button
                        class={`flex flex-col gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                          isActive
                            ? "border-[var(--primary)] bg-[var(--active-bg)]"
                            : "border-[var(--border)] bg-transparent hover:bg-[var(--hover-bg)]"
                        }`}
                        onClick={() => setSettings("theme", id)}
                      >
                        {/* Rich preview */}
                        <div class="w-full h-20 rounded-xl overflow-hidden flex shadow-sm" style={{ background: t.vars.background }}>
                          {/* Sidebar */}
                          <div class="w-8 h-full shrink-0 flex flex-col pt-2 px-1 gap-1" style={{ background: t.vars.sidebar, "border-right": `1px solid ${t.vars.sidebarBorder}` }}>
                            <div class="rounded h-1.5 w-full" style={{ background: t.vars.primary, opacity: "0.9" }} />
                            <div class="rounded h-1.5 w-4/5" style={{ background: t.vars.sidebarForeground, opacity: "0.2" }} />
                            <div class="rounded h-1.5 w-4/5" style={{ background: t.vars.sidebarForeground, opacity: "0.2" }} />
                          </div>
                          {/* Email list */}
                          <div class="flex-1 flex flex-col gap-1 p-2">
                            <div class="flex gap-1.5 items-center">
                              <div class="rounded-full h-2 w-2 shrink-0" style={{ background: t.vars.primary }} />
                              <div class="rounded h-1.5 flex-1" style={{ background: t.vars.foreground, opacity: "0.3" }} />
                            </div>
                            <div class="flex gap-1.5 items-center">
                              <div class="rounded-full h-2 w-2 shrink-0" style={{ background: t.vars.foreground, opacity: "0.1" }} />
                              <div class="rounded h-1.5 w-3/4" style={{ background: t.vars.foreground, opacity: "0.15" }} />
                            </div>
                            <div class="flex gap-1.5 items-center">
                              <div class="rounded-full h-2 w-2 shrink-0" style={{ background: t.vars.foreground, opacity: "0.1" }} />
                              <div class="rounded h-1.5 w-2/3" style={{ background: t.vars.foreground, opacity: "0.12" }} />
                            </div>
                          </div>
                        </div>
                        {/* Color palette strip */}
                        <div class="flex gap-1 px-0.5">
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.background }} />
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.card }} />
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.primary }} />
                          <div class="flex-1 h-1.5 rounded-full" style={{ background: t.vars.accent }} />
                        </div>
                        <div class="flex items-center justify-between">
                          <span class={`text-sm font-semibold ${isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>{t.name}</span>
                          {isActive && (
                            <div class="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: t.vars.primary }}>
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "labels"}>
            <div class="flex flex-col gap-6">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-[var(--foreground)]">Labels</h2>
                <button
                  onClick={() => setShowNewLabel(true)}
                  class="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium border-none cursor-pointer hover:brightness-110 transition-all"
                >
                  <IconPlus size={16} />
                  New label
                </button>
              </div>

              {/* New label form */}
              <Show when={showNewLabel()}>
                <div class="flex flex-col gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--search-bg)]">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-[var(--foreground)]">Create new label</span>
                    <button
                      onClick={() => setShowNewLabel(false)}
                      class="w-7 h-7 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                    >
                      <IconClose size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Label name"
                    value={newLabelName()}
                    onInput={(e) => setNewLabelName(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
                    class="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none"
                  />
                  <div class="flex gap-2 flex-wrap">
                    <For each={LABEL_COLORS}>
                      {(color) => (
                        <button
                          class={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all ${
                            newLabelColor() === color ? "border-[var(--foreground)] scale-110" : "border-transparent hover:scale-110"
                          }`}
                          style={{ background: color }}
                          onClick={() => setNewLabelColor(color)}
                        />
                      )}
                    </For>
                  </div>
                  <button
                    onClick={handleAddLabel}
                    disabled={!newLabelName().trim()}
                    class="self-start px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </Show>

              {/* Labels list */}
              <div class="flex flex-col gap-1">
                <div class="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <span>Color</span>
                  <span>Name</span>
                  <span>Actions</span>
                </div>
                <For each={visibleLabels()}>
                  {(label) => (
                    <div class="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-3 rounded-lg hover:bg-[var(--hover-bg)] transition-colors group">
                      <Show when={editingLabel() === label.id} fallback={
                        <span class="w-4 h-4 rounded-full" style={{ background: label.color }} />
                      }>
                        <div class="flex gap-1 flex-wrap">
                          <For each={LABEL_COLORS}>
                            {(color) => (
                              <button
                                class={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all ${
                                  label.color === color ? "border-[var(--foreground)] scale-110" : "border-transparent hover:scale-105"
                                }`}
                                style={{ background: color }}
                                onClick={() => updateLabel(label.id, { color })}
                              />
                            )}
                          </For>
                        </div>
                      </Show>

                      <Show when={editingLabel() === label.id} fallback={
                        <span class="text-sm font-medium text-[var(--foreground)]">{label.name}</span>
                      }>
                        <input
                          type="text"
                          value={label.name}
                          onInput={(e) => updateLabel(label.id, { name: e.currentTarget.value })}
                          onKeyDown={(e) => e.key === "Enter" && setEditingLabel(null)}
                          class="h-8 px-2 rounded border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none"
                        />
                      </Show>

                      <div class="flex items-center gap-1">
                        <Show when={editingLabel() === label.id} fallback={
                          <button
                            onClick={() => setEditingLabel(label.id)}
                            class="w-7 h-7 rounded border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--active-bg)] hover:text-[var(--primary)] transition-all"
                            title="Edit"
                          >
                            <IconEdit size={14} />
                          </button>
                        }>
                          <button
                            onClick={() => setEditingLabel(null)}
                            class="px-3 py-1 rounded text-xs font-medium bg-[var(--primary)] text-white border-none cursor-pointer hover:brightness-110"
                          >
                            Done
                          </button>
                        </Show>
                        <button
                          onClick={() => {
                            removeLabel(label.id);
                            if (editingLabel() === label.id) setEditingLabel(null);
                          }}
                          class="w-7 h-7 rounded border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-[var(--destructive)] transition-all"
                          title="Delete"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              {/* Auto-label rules */}
              <div class="flex flex-col gap-3 pt-3 border-t border-[var(--border-light)]">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3 class="text-base font-semibold text-[var(--foreground)]">Destination label rules</h3>
                    <p class="text-xs text-[var(--text-muted)] mt-1">
                      Create rules like: "when destination matches X, apply label Y".
                    </p>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={handleAddAliasPresetRule}
                        class="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--card)] text-[11px] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--hover-bg)]"
                      >
                        Preset: alias@inout.email -&gt; alias
                      </button>
                      <button
                        onClick={handleAddPlusTagPresetRule}
                        class="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--card)] text-[11px] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--hover-bg)]"
                      >
                        Preset: +label:work -&gt; work
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleAddAutoRule}
                    disabled={visibleLabels().length === 0}
                    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconPlus size={14} />
                    New rule
                  </button>
                </div>

                <Show when={visibleLabels().length === 0}>
                  <div class="text-xs text-[var(--text-muted)] p-3 rounded-lg border border-[var(--border)] bg-[var(--search-bg)]">
                    Create at least one label before adding destination rules.
                  </div>
                </Show>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label class="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] p-2 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <input
                      type="checkbox"
                      class="w-4 h-4 accent-[var(--primary)]"
                      checked={autoLabelRulesState.stopAfterFirstMatch}
                      onChange={(e) => updateAutoLabelRulesSettings({ stopAfterFirstMatch: e.currentTarget.checked })}
                    />
                    Stop after first matching rule
                  </label>
                  <label class="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] p-2 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <input
                      type="checkbox"
                      class="w-4 h-4 accent-[var(--primary)]"
                      checked={autoLabelRulesState.autoCreateLabelsFromTemplate}
                      onChange={(e) => updateAutoLabelRulesSettings({ autoCreateLabelsFromTemplate: e.currentTarget.checked })}
                    />
                    Auto-create missing labels from templates
                  </label>
                </div>

                <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <h4 class="text-sm font-semibold text-[var(--foreground)]">Examples</h4>
                    <span class="text-[11px] text-[var(--text-muted)]">Click to add as a new rule</span>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div class="rounded-lg border border-[var(--border)] p-2 bg-[var(--search-bg)]">
                      <p class="text-[11px] font-medium text-[var(--foreground)]">import@inout.email -&gt; import</p>
                      <p class="text-[11px] text-[var(--text-muted)] mt-1">Exact destination match to fixed label.</p>
                      <button
                        onClick={() => handleUseExampleRule("import")}
                        class="mt-2 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--card)] text-[11px] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--hover-bg)]"
                      >
                        Use example
                      </button>
                    </div>
                    <div class="rounded-lg border border-[var(--border)] p-2 bg-[var(--search-bg)]">
                      <p class="text-[11px] font-medium text-[var(--foreground)]">receipts@inout.email -&gt; receipts</p>
                      <p class="text-[11px] text-[var(--text-muted)] mt-1">Another exact-match fixed label rule.</p>
                      <button
                        onClick={() => handleUseExampleRule("receipts")}
                        class="mt-2 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] text-[11px] cursor-pointer hover:bg-[var(--hover-bg)]"
                      >
                        Use example
                      </button>
                    </div>
                    <div class="rounded-lg border border-[var(--border)] p-2 bg-[var(--search-bg)]">
                      <p class="text-[11px] font-medium text-[var(--foreground)]">admin+label:work@inout.email -&gt; work</p>
                      <p class="text-[11px] text-[var(--text-muted)] mt-1">Regex + template (`$1`) using plus-tag capture.</p>
                      <button
                        onClick={() => handleUseExampleRule("plusTag")}
                        class="mt-2 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] text-[11px] cursor-pointer hover:bg-[var(--hover-bg)]"
                      >
                        Use example
                      </button>
                    </div>
                    <div class="rounded-lg border border-[var(--border)] p-2 bg-[var(--search-bg)]">
                      <p class="text-[11px] font-medium text-[var(--foreground)]">team@inout.email -&gt; team</p>
                      <p class="text-[11px] text-[var(--text-muted)] mt-1">Dynamic alias mapping from local-part (`$1`).</p>
                      <button
                        onClick={() => handleUseExampleRule("localPart")}
                        class="mt-2 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] text-[11px] cursor-pointer hover:bg-[var(--hover-bg)]"
                      >
                        Use example
                      </button>
                    </div>
                  </div>
                </div>

                <Show when={autoLabelRulesState.rules.length > 0} fallback={
                  <div class="text-xs text-[var(--text-muted)] p-3 rounded-lg border border-[var(--border)] bg-[var(--search-bg)]">
                    No rules yet.
                  </div>
                }>
                  <div class="flex flex-col gap-2">
                    <For each={autoLabelRulesState.rules}>
                      {(rule) => {
                        const regexOk = () => isRegexValid(rule.matchType, rule.pattern, rule.caseSensitive);
                          const preview = () => {
                            const left = `"${targetFieldDisplay(rule.targetField)} ${matchTypeDisplay(rule.matchType)} ${rule.pattern || "…"}"`;
                            const right = rule.labelMode === "fixed"
                            ? `label "${visibleLabels().find((l) => l.id === rule.labelId)?.name || "…"}"`
                            : `template "${rule.labelTemplate || "…"}"`;
                          return `${left} -> ${right}`;
                        };
                        return (
                          <div class={`flex flex-col gap-3 p-3 rounded-xl border ${rule.enabled ? "border-[var(--border)]" : "border-dashed border-[var(--border)] opacity-70"} bg-[var(--card)]`}>
                            <div class="flex items-center justify-between gap-2">
                              <div class="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={rule.enabled}
                                  onChange={(e) => updateAutoLabelRule(rule.id, { enabled: e.currentTarget.checked })}
                                  class="w-4 h-4 accent-[var(--primary)] cursor-pointer"
                                  title="Enable rule"
                                />
                                <span class="text-xs font-semibold text-[var(--foreground)]">{`Rule ${rule.priority}`}</span>
                                <span class="text-[11px] text-[var(--text-muted)] truncate">{preview()}</span>
                              </div>
                              <div class="flex items-center gap-2">
                                <select
                                  class="h-8 px-2 rounded border border-[var(--border)] bg-[var(--card)] text-[11px] text-[var(--foreground)] outline-none"
                                  value={String(rule.priority)}
                                  onChange={(e) => updateAutoLabelRule(rule.id, { priority: Number(e.currentTarget.value) || 1 })}
                                  title="Priority"
                                >
                                  <For each={Array.from({ length: Math.max(10, autoLabelRulesState.rules.length + 2) }, (_, i) => i + 1)}>
                                    {(num) => <option value={String(num)}>{`#${num}`}</option>}
                                  </For>
                                </select>
                                <button
                                  onClick={() => removeAutoLabelRule(rule.id)}
                                  class="w-8 h-8 rounded border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-red-50 hover:text-[var(--destructive)] transition-all"
                                  title="Delete rule"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-[52px_1fr] gap-2 items-center">
                              <span class="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">When</span>
                              <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <select
                                  class="h-9 px-2 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] outline-none"
                                  value={rule.targetField}
                                  onChange={(e) => updateAutoLabelRule(rule.id, { targetField: e.currentTarget.value as DestinationTargetField })}
                                >
                                  <option value="destinationAddress">Destination address</option>
                                  <option value="destinationLocalPart">Local-part</option>
                                  <option value="destinationPlusTag">Plus-tag</option>
                                </select>
                                <select
                                  class="h-9 px-2 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] outline-none"
                                  value={rule.matchType}
                                  onChange={(e) => updateAutoLabelRule(rule.id, { matchType: e.currentTarget.value as DestinationMatchType })}
                                >
                                  <option value="exact">is exactly</option>
                                  <option value="contains">contains</option>
                                  <option value="regex">matches regex</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder={rule.matchType === "regex" ? "e.g. ^admin\\+label:([^@]+)@inout\\.email$" : "Pattern"}
                                  value={rule.pattern}
                                  onInput={(e) => updateAutoLabelRule(rule.id, { pattern: e.currentTarget.value })}
                                  class={`${regexOk() ? "border-[var(--border)]" : "border-red-400"} h-9 px-3 rounded border bg-[var(--card)] text-xs text-[var(--foreground)] outline-none`}
                                />
                              </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-[52px_1fr] gap-2 items-center">
                              <span class="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Then</span>
                              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <select
                                  class="h-9 px-2 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] outline-none"
                                  value={rule.labelMode}
                                  onChange={(e) => updateAutoLabelRule(rule.id, { labelMode: e.currentTarget.value as LabelResolutionMode })}
                                >
                                  <option value="fixed">Apply fixed label</option>
                                  <option value="template">Generate from template</option>
                                </select>
                                <Show
                                  when={rule.labelMode === "fixed"}
                                  fallback={
                                    <input
                                      type="text"
                                      placeholder='Template (e.g. "$1" or "team-$1")'
                                      value={rule.labelTemplate}
                                      onInput={(e) => updateAutoLabelRule(rule.id, { labelTemplate: e.currentTarget.value })}
                                      class="h-9 px-3 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] outline-none"
                                    />
                                  }
                                >
                                  <select
                                    class="h-9 px-2 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] outline-none"
                                    value={rule.labelId}
                                    onChange={(e) => updateAutoLabelRule(rule.id, { labelId: e.currentTarget.value })}
                                  >
                                    <option value="">Select label</option>
                                    <For each={visibleLabels()}>
                                      {(label) => <option value={label.id}>{label.name}</option>}
                                    </For>
                                  </select>
                                </Show>
                              </div>
                            </div>

                            <div class="flex items-center justify-between">
                              <label class="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                <input
                                  type="checkbox"
                                  class="w-4 h-4 accent-[var(--primary)]"
                                  checked={rule.caseSensitive}
                                  onChange={(e) => updateAutoLabelRule(rule.id, { caseSensitive: e.currentTarget.checked })}
                                />
                                Case sensitive
                              </label>
                              <Show when={!regexOk()}>
                                <span class="text-[11px] text-red-500">Invalid regex pattern</span>
                              </Show>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "categories"}>
            <div class="flex flex-col gap-6">
              <div>
                <h2 class="text-xl font-semibold text-[var(--foreground)]">Categories</h2>
                <p class="text-sm text-[var(--text-muted)] mt-1">
                  Manage Inbox category tabs. Primary is always Inbox.
                </p>
              </div>

              <label class="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] w-fit">
                <input
                  type="checkbox"
                  class="w-4 h-4 accent-[var(--primary)]"
                  checked={settings.enableCategories}
                  onChange={(e) => setSettings("enableCategories", e.currentTarget.checked)}
                />
                Enable categories
              </label>

              <div class="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategoryName()}
                  onInput={(e) => setNewCategoryName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  class="h-9 flex-1 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName().trim()}
                  class="h-9 px-3 rounded-lg bg-[var(--primary)] text-white text-sm font-medium border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50"
                >
                  Add category
                </button>
              </div>

              <div class="flex flex-col gap-1">
                <For each={configuredCategories()}>
                  {(category) => {
                    const CategoryIcon = categoryIconById(category.icon);
                    return (
                      <div class="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                        <CategoryIcon size={15} class="text-[var(--text-secondary)]" />
                        <span class="flex-1 text-sm text-[var(--foreground)]">{category.name}</span>
                        <div class="relative">
                          <button
                            onClick={() => setOpenCategoryIconPicker((current) => current === category.key ? null : category.key)}
                            class="h-8 min-w-[128px] px-2 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] cursor-pointer inline-flex items-center gap-2 justify-between"
                          >
                            <span class="inline-flex items-center gap-2">
                              <CategoryIcon size={13} />
                              {categoryIconLabel(category.icon)}
                            </span>
                            <IconChevronDown size={12} />
                          </button>
                          <Show when={openCategoryIconPicker() === category.key}>
                            <div class="absolute right-0 mt-1 w-[160px] rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg p-1 z-20">
                              <For each={categoryIconOptions}>
                                {(option) => {
                                  const OptionIcon = categoryIconById(option.id);
                                  return (
                                    <button
                                      onClick={() => {
                                        updateCategory(category.key, { icon: option.id });
                                        setOpenCategoryIconPicker(null);
                                      }}
                                      class={`w-full px-2 py-1.5 rounded text-xs cursor-pointer border-none inline-flex items-center gap-2 ${
                                        category.icon === option.id
                                          ? "bg-[var(--active-bg)] text-[var(--primary)]"
                                          : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                      }`}
                                    >
                                      <OptionIcon size={13} />
                                      {option.label}
                                    </button>
                                  );
                                }}
                              </For>
                            </div>
                          </Show>
                        </div>
                        <button
                          onClick={() => removeCategory(category.key)}
                          class="w-7 h-7 rounded border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-red-50 hover:text-[var(--destructive)] transition-all"
                          title="Delete category"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    );
                  }}
                </For>
                <Show when={configuredCategories().length === 0}>
                  <div class="text-xs text-[var(--text-muted)] p-3 rounded-lg border border-[var(--border)] bg-[var(--search-bg)]">
                    No categories configured. Inbox will show all messages as Primary.
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "signature"}>
            <div class="flex flex-col gap-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-semibold text-[var(--foreground)]">Email Signatures</h2>
                  <p class="text-sm text-[var(--text-muted)] mt-1">
                    Create multiple signatures and choose which one to use when composing emails.
                  </p>
                </div>
                <button
                  onClick={startNewSignature}
                  class="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium border-none cursor-pointer hover:brightness-110 transition-all"
                >
                  <IconPlus size={16} />
                  New signature
                </button>
              </div>

              {/* Signature list */}
              <Show when={signatureState.signatures.length > 0 && !showNewSignature() && !editingSignatureId()}>
                <div class="flex flex-col gap-2">
                  <For each={signatureState.signatures}>
                    {(sig) => (
                      <div
                        class={`flex items-start gap-4 p-4 rounded-xl border transition-all group cursor-pointer ${
                          signatureState.defaultId === sig.id
                            ? "border-[var(--primary)] bg-[var(--active-bg)]"
                            : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--hover-bg)]"
                        }`}
                        onClick={() => startEditSignature(sig.id)}
                      >
                        {/* Default radio */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDefaultSignature(signatureState.defaultId === sig.id ? null : sig.id);
                          }}
                          class="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer bg-transparent transition-colors shrink-0"
                          classList={{
                            "border-[var(--primary)]": signatureState.defaultId === sig.id,
                            "border-[var(--border)]": signatureState.defaultId !== sig.id,
                          }}
                          title={signatureState.defaultId === sig.id ? "Default signature (click to unset)" : "Set as default"}
                        >
                          <Show when={signatureState.defaultId === sig.id}>
                            <span class="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
                          </Show>
                        </button>

                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm font-semibold text-[var(--foreground)]">{sig.name}</span>
                            <Show when={signatureState.defaultId === sig.id}>
                              <span class="text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Default</span>
                            </Show>
                          </div>
                          <div
                            class="text-xs text-[var(--text-muted)] line-clamp-2 overflow-hidden"
                            innerHTML={sig.html}
                          />
                        </div>

                        {/* Actions */}
                        <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditSignature(sig.id); }}
                            class="w-7 h-7 rounded border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--active-bg)] hover:text-[var(--primary)] transition-all"
                            title="Edit"
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeSignature(sig.id); }}
                            class="w-7 h-7 rounded border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-red-50 hover:text-[var(--destructive)] transition-all"
                            title="Delete"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* Empty state */}
              <Show when={signatureState.signatures.length === 0 && !showNewSignature()}>
                <div class="flex flex-col items-center justify-center py-12 text-center">
                  <IconSignature size={48} class="text-[var(--text-muted)] mb-3 opacity-40" />
                  <p class="text-sm text-[var(--text-muted)]">No signatures yet. Create one to get started.</p>
                </div>
              </Show>

              {/* Editor: new or editing */}
              <Show when={showNewSignature() || editingSignatureId()}>
                <div class="flex flex-col gap-4 p-5 rounded-xl border border-[var(--border)] bg-[var(--search-bg)]">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-[var(--foreground)]">
                      {editingSignatureId() ? "Edit Signature" : "New Signature"}
                    </span>
                    <button
                      onClick={cancelSignatureEditor}
                      class="w-7 h-7 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                    >
                      <IconClose size={14} />
                    </button>
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--text-muted)]">Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Work, Personal"
                      value={signatureEditorName()}
                      onInput={(e) => setSignatureEditorName(e.currentTarget.value)}
                      class="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none"
                    />
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--text-muted)]">Content</label>
                    <div class="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                      {(() => {
                        const _key = signatureEditorKey();
                        return (
                          <LexicalEditor
                            initialContent={signatureEditorHtml()}
                            placeholder="Create your signature... (e.g., name, title, contact info)"
                            onChange={(html) => {
                              setSignatureEditorHtml(html);
                              setSignatureSaved(false);
                            }}
                          />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Preview */}
                  <Show when={signatureEditorHtml().trim() && signatureEditorHtml() !== "<p><br></p>"}>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-[var(--text-muted)]">Preview</label>
                      <div
                        class="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)]"
                        innerHTML={signatureEditorHtml()}
                      />
                    </div>
                  </Show>

                  <div class="flex items-center gap-3">
                    <button
                      onClick={saveCurrentSignature}
                      disabled={!signatureEditorHtml().trim() || signatureEditorHtml() === "<p><br></p>"}
                      class="px-6 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {editingSignatureId() ? "Update Signature" : "Create Signature"}
                    </button>
                    <button
                      onClick={cancelSignatureEditor}
                      class="px-4 py-2 rounded-lg bg-transparent text-[var(--text-secondary)] text-sm font-medium border border-[var(--border)] cursor-pointer hover:bg-[var(--hover-bg)] transition-all"
                    >
                      Cancel
                    </button>
                    <Show when={signatureSaved()}>
                      <span class="text-sm text-[#34a853] font-medium">Saved!</span>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === "import"}>
            <div class="flex flex-col gap-6">
              <div class="rounded-2xl border border-[var(--border)] bg-[var(--search-bg)] p-5 flex flex-col gap-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-white border border-[var(--border)] flex items-center justify-center">
                    <img src="/gmail-logo.svg" alt="Gmail logo" class="w-6 h-6 object-contain" />
                  </div>
                  <div>
                    <h2 class="text-xl font-semibold text-[var(--foreground)]">Import from Google Takeout</h2>
                    <p class="text-sm text-[var(--text-muted)] mt-0.5">Bring your Gmail archive into your mailbox with a guided flow.</p>
                  </div>
                </div>

                <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <p class="text-sm font-semibold text-[var(--foreground)]">How to get your file</p>
                  <div class="mt-2 text-sm text-[var(--text-secondary)] flex flex-col gap-1">
                    <span>1. Open <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" class="text-[var(--primary)] font-medium no-underline hover:underline">Google Takeout</a>.</span>
                    <span>2. Select only <strong>Mail</strong>.</span>
                    <span>3. Export once and download the archive (`.tgz` or `.tar.gz`).</span>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-full bg-[var(--active-bg)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">1</span>
                  <label class="text-sm font-semibold text-[var(--foreground)]">Choose archive source</label>
                </div>
                <div class="flex gap-2 max-w-[560px]">
                  <button
                    onClick={() => {
                      setImportSourceMode("upload");
                      resetTakeoutAnalysis();
                    }}
                    class={`w-full text-left px-4 py-3 rounded-xl text-sm border cursor-pointer transition-all ${
                      importSourceMode() === "upload"
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)] shadow-sm"
                        : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)]"
                    }`}
                  >
                    <span class="font-semibold block">Upload from this device</span>
                    <span class="text-xs opacity-80">Choose a local .tgz or .tar.gz file.</span>
                  </button>
                  <button
                    onClick={() => {
                      setImportSourceMode("server");
                      resetTakeoutAnalysis();
                      void loadServerTakeoutFiles();
                    }}
                    class={`w-full text-left px-4 py-3 rounded-xl text-sm border cursor-pointer transition-all ${
                      importSourceMode() === "server"
                        ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)] shadow-sm"
                        : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)]"
                    }`}
                  >
                    <span class="font-semibold block">Use file already on server</span>
                    <span class="text-xs opacity-80">Reference a file in <code>/var/lib/custom-webmail/takeout-imports</code>.</span>
                  </button>
                </div>

                <input
                  ref={takeoutFileInputRef}
                  type="file"
                  accept=".tgz,.tar.gz,application/gzip,application/x-gzip"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] || null;
                    setSelectedTakeoutFile(file);
                    setTakeoutUploadPercent(0);
                    setTakeoutError(null);
                    resetTakeoutAnalysis();
                  }}
                  class="hidden"
                />
                <Show when={importSourceMode() === "upload"}>
                  <div class="flex flex-col gap-3">
                    <div class="rounded-xl border border-[var(--border)] bg-[var(--search-bg)] p-3 flex items-center gap-3">
                      <button
                        onClick={() => takeoutFileInputRef?.click()}
                        class="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold border-none cursor-pointer hover:brightness-110 transition-all"
                      >
                        Choose File
                      </button>
                      <span class="text-sm text-[var(--text-secondary)] truncate">
                        {selectedTakeoutFile() ? selectedTakeoutFile()!.name : "No file selected (.tgz or .tar.gz)"}
                      </span>
                    </div>
                    <Show when={selectedTakeoutFile()}>
                      <div class="text-xs rounded-lg border border-[var(--border)] bg-[var(--search-bg)] px-3 py-2 text-[var(--text-muted)]">
                        Selected file: <span class="text-[var(--foreground)] font-medium">{selectedTakeoutFile()!.name}</span> ({formatBytes(selectedTakeoutFile()!.size)})
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={importSourceMode() === "server"}>
                  <div class="rounded-xl border border-[var(--border)] bg-[var(--search-bg)] p-4 flex flex-col gap-3">
                    <p class="text-xs text-[var(--text-muted)]">
                      Place the archive in <code>/var/lib/custom-webmail/takeout-imports</code>, then enter only the filename.
                    </p>
                    <Show when={!serverTakeoutFilesUnavailable()}>
                      <div class="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 flex flex-col gap-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-semibold text-[var(--foreground)]">Available files on server</span>
                          <button
                            onClick={() => void loadServerTakeoutFiles()}
                            disabled={serverTakeoutFilesLoading()}
                            class="px-2 py-1 rounded border border-[var(--border)] bg-transparent text-xs text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--hover-bg)] disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {serverTakeoutFilesLoading() ? "Refreshing..." : "Refresh"}
                          </button>
                        </div>
                        <Show when={!serverTakeoutFilesLoading() && serverTakeoutFiles().length === 0}>
                          <div class="text-xs text-[var(--text-muted)]">No `.tgz` or `.tar.gz` files found right now.</div>
                        </Show>
                        <Show when={serverTakeoutFiles().length > 0}>
                          <div class="max-h-40 overflow-y-auto rounded border border-[var(--border)] bg-[var(--search-bg)]">
                            <For each={serverTakeoutFiles()}>
                              {(file) => (
                                <button
                                  onClick={() => {
                                    setServerTakeoutFilename(file.filename);
                                    resetTakeoutAnalysis();
                                  }}
                                  class={`w-full flex items-center justify-between gap-3 px-3 py-2 border-none border-b border-[var(--border)] last:border-b-0 cursor-pointer text-left ${
                                    serverTakeoutFilename() === file.filename
                                      ? "bg-[var(--active-bg)] text-[var(--primary)]"
                                      : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                  }`}
                                >
                                  <span class="truncate text-xs font-medium">{file.filename}</span>
                                  <span class="text-[11px] opacity-80 shrink-0">
                                    {formatBytes(file.fileSizeBytes)} · {new Date(file.modifiedAt).toLocaleString()}
                                  </span>
                                </button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </Show>
                    <Show when={serverTakeoutFilesUnavailable()}>
                      <div class="text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--text-muted)]">
                        Server file listing is unavailable right now. You can still type the filename manually.
                      </div>
                    </Show>
                    <div class="flex items-center gap-3">
                      <input
                        type="text"
                        value={serverTakeoutFilename()}
                        onInput={(e) => {
                          setServerTakeoutFilename(e.currentTarget.value);
                          resetTakeoutAnalysis();
                        }}
                        placeholder="your-archive.tgz"
                        class="flex-1 min-w-0 h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <label class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={deleteServerFileAfterImport()}
                        onChange={(e) => setDeleteServerFileAfterImport(e.currentTarget.checked)}
                      />
                      Delete server file after successful import
                    </label>
                  </div>
                </Show>

                <div class="h-px bg-[var(--border)]" />

                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-full bg-[var(--active-bg)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">2</span>
                  <label class="text-sm font-semibold text-[var(--foreground)]">Analyze archive</label>
                </div>
                <Show when={!takeoutJobsApiAvailable()}>
                  <div class="text-xs rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[var(--destructive)]">
                    Takeout import API endpoints are not available on this server (404). Deploy the latest backend to use this flow.
                  </div>
                </Show>
                <div class="flex items-center gap-3">
                  <button
                    onClick={() => void runTakeoutArchiveAnalysis()}
                    disabled={!takeoutJobsApiAvailable() || takeoutBusy() || takeoutAnalysisBusy() || (importSourceMode() === "upload" ? !selectedTakeoutFile() : !serverTakeoutFilename().trim())}
                    class="min-w-[220px] px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {takeoutAnalysisBusy()
                      ? "Analyzing..."
                      : importSourceMode() === "server"
                        ? "Analyze Server Archive"
                        : canResumeCurrentUpload()
                          ? "Resume Upload and Analyze"
                          : "Upload Archive and Analyze"}
                  </button>
                </div>

                <div class="h-px bg-[var(--border)]" />

                <Show when={analysisMatchesCurrentJob()}>
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-full bg-[var(--active-bg)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">3</span>
                    <label class="text-sm font-semibold text-[var(--foreground)]">Import labels, categories, and signatures</label>
                  </div>
                  <div class="rounded-xl border border-[var(--border)] bg-[var(--search-bg)] p-4 flex flex-col gap-3">
                    <div class="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                      <div>Estimated emails: <span class="font-semibold text-[var(--foreground)]">{takeoutAnalysis()!.estimatedTotalMessages}</span></div>
                      <div>Custom labels found: <span class="font-semibold text-[var(--foreground)]">{takeoutCustomLabelPlan().length}</span></div>
                      <div>Category labels found: <span class="font-semibold text-[var(--foreground)]">{takeoutCategoryPlan().length}</span></div>
                      <div>Blocked senders found: <span class="font-semibold text-[var(--foreground)]">{Array.isArray(takeoutAnalysis()!.blockedSenders) ? takeoutAnalysis()!.blockedSenders.length : 0}</span></div>
                      <div>Sent messages: <span class="font-semibold text-[var(--foreground)]">{takeoutAnalysis()!.systemLabels.sent}</span></div>
                      <div>Spam messages: <span class="font-semibold text-[var(--foreground)]">{takeoutAnalysis()!.systemLabels.spam}</span></div>
                      <div>Trash messages: <span class="font-semibold text-[var(--foreground)]">{takeoutAnalysis()!.systemLabels.trash}</span></div>
                    </div>
                    <div class="flex flex-col gap-2 text-sm">
                      <label class="flex items-center gap-2 text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={includeSentMessages()}
                          onChange={(e) => setIncludeSentMessages(e.currentTarget.checked)}
                        />
                        Import sent messages
                      </label>
                      <label class="flex items-center gap-2 text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={includeSpamMessages()}
                          onChange={(e) => setIncludeSpamMessages(e.currentTarget.checked)}
                        />
                        Import spam messages
                      </label>
                      <label class="flex items-center gap-2 text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={includeTrashMessages()}
                          onChange={(e) => setIncludeTrashMessages(e.currentTarget.checked)}
                        />
                        Import trash messages
                      </label>
                    </div>
                    <label class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={importTakeoutCategories()}
                        onChange={(e) => setImportTakeoutCategories(e.currentTarget.checked)}
                      />
                      Import categories from Takeout ({takeoutCategoryPlan().length})
                    </label>
                    <Show when={importTakeoutCategories() && takeoutCategoryPlan().length > 0}>
                      <div class="max-h-56 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
                        <div class="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_70px] gap-2 px-3 py-2 text-[11px] font-semibold text-[var(--text-muted)] border-b border-[var(--border)]">
                          <span>Takeout Category Label</span>
                          <span>Messages</span>
                          <span>Create/Use Category</span>
                          <span>Import</span>
                        </div>
                        <For each={takeoutCategoryPlan()}>
                          {(item) => (
                            <div class="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_70px] gap-2 px-3 py-2 text-xs items-center border-b border-[var(--border)] last:border-b-0">
                              <span class="truncate text-[var(--foreground)]">{item.sourceName}</span>
                              <span class="text-[var(--text-secondary)]">{item.count}</span>
                              <input
                                type="text"
                                value={item.targetName}
                                onInput={(e) => updateLabelPlanItem(item.sourceName, { targetName: e.currentTarget.value })}
                                placeholder="Category name"
                                class="h-8 rounded-md border border-[var(--border)] bg-[var(--search-bg)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                              />
                              <label class="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={item.enabled}
                                  onChange={(e) => updateLabelPlanItem(item.sourceName, { enabled: e.currentTarget.checked })}
                                />
                              </label>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                    <label class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={importTakeoutLabels()}
                        onChange={(e) => setImportTakeoutLabels(e.currentTarget.checked)}
                      />
                      Import custom labels ({takeoutCustomLabelPlan().length})
                    </label>
                    <Show when={importTakeoutLabels() && takeoutCustomLabelPlan().length > 0}>
                      <div class="max-h-56 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
                        <div class="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_80px_70px] gap-2 px-3 py-2 text-[11px] font-semibold text-[var(--text-muted)] border-b border-[var(--border)]">
                          <span>Found Label</span>
                          <span>Messages</span>
                          <span>Import As</span>
                          <span>Color</span>
                          <span>Import</span>
                        </div>
                        <For each={takeoutCustomLabelPlan()}>
                          {(item) => (
                            <div class="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_80px_70px] gap-2 px-3 py-2 text-xs items-center border-b border-[var(--border)] last:border-b-0">
                              <span class="truncate text-[var(--foreground)]">{item.sourceName}</span>
                              <span class="text-[var(--text-secondary)]">{item.count}</span>
                              <input
                                type="text"
                                value={item.targetName}
                                onInput={(e) => updateLabelPlanItem(item.sourceName, { targetName: e.currentTarget.value })}
                                placeholder="Label name"
                                class="h-8 rounded-md border border-[var(--border)] bg-[var(--search-bg)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                              />
                              <input
                                type="color"
                                value={item.color}
                                onInput={(e) => updateLabelPlanItem(item.sourceName, { color: e.currentTarget.value })}
                                class="h-8 w-12 rounded border border-[var(--border)] bg-[var(--card)] p-0 cursor-pointer"
                              />
                              <label class="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={item.enabled}
                                  onChange={(e) => updateLabelPlanItem(item.sourceName, { enabled: e.currentTarget.checked })}
                                />
                              </label>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                    <label class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={importTakeoutSignatures()}
                        onChange={(e) => setImportTakeoutSignatures(e.currentTarget.checked)}
                      />
                      Import signatures from Takeout settings ({takeoutSignaturePlan().length})
                    </label>
                    <Show when={importTakeoutSignatures() && takeoutSignaturePlan().length > 0}>
                      <div class="max-h-56 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-3 flex flex-col gap-3">
                        <For each={takeoutSignaturePlan()}>
                          {(signature, index) => (
                            <div class="rounded-lg border border-[var(--border)] bg-[var(--search-bg)] p-3 flex flex-col gap-2">
                              <div class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={signature.enabled}
                                  onChange={(e) => updateSignaturePlanItem(index(), { enabled: e.currentTarget.checked })}
                                />
                                <input
                                  type="text"
                                  value={signature.title}
                                  onInput={(e) => updateSignaturePlanItem(index(), { title: e.currentTarget.value })}
                                  class="flex-1 h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                                />
                              </div>
                              <div class="text-xs text-[var(--text-muted)]">Preview</div>
                              <div class="rounded-md border border-[var(--border)] bg-[var(--card)] p-2 text-xs text-[var(--foreground)]" innerHTML={signature.html} />
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                    <label class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={importTakeoutBlockedSenders()}
                        onChange={(e) => setImportTakeoutBlockedSenders(e.currentTarget.checked)}
                      />
                      Import blocked senders from Takeout settings ({Array.isArray(takeoutAnalysis()!.blockedSenders) ? takeoutAnalysis()!.blockedSenders.length : 0})
                    </label>
                    <Show when={importTakeoutBlockedSenders() && Array.isArray(takeoutAnalysis()!.blockedSenders) && takeoutAnalysis()!.blockedSenders.length > 0}>
                      <div class="max-h-40 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-2 text-xs text-[var(--foreground)]">
                        <For each={takeoutAnalysis()!.blockedSenders}>
                          {(sender) => (
                            <div class="px-1 py-1 border-b border-[var(--border)] last:border-b-0">{sender}</div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                  <div class="h-px bg-[var(--border)]" />

                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-full bg-[var(--active-bg)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">4</span>
                    <label class="text-sm font-semibold text-[var(--foreground)]">Start import</label>
                  </div>
                  <div class="flex items-center gap-3">
                    <button
                      onClick={() => void startAnalyzedTakeoutImport()}
                      disabled={takeoutBusy() || !analysisMatchesCurrentJob()}
                      class="min-w-[220px] px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {takeoutBusy() ? "Processing..." : "Start Import"}
                    </button>
                    <Show when={takeoutJob() && activeImportStatuses.includes(takeoutJob()!.status)}>
                      <button
                        onClick={cancelTakeoutImport}
                        disabled={takeoutBusy()}
                        class="min-w-[220px] px-4 py-2.5 rounded-lg bg-transparent text-[var(--text-secondary)] text-sm font-medium border border-[var(--border)] cursor-pointer hover:bg-[var(--hover-bg)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Cancel Current Import
                      </button>
                    </Show>
                  </div>
                </Show>

              </div>

              <Show when={importSourceMode() === "upload" && takeoutUploadPercent() > 0 && takeoutUploadPercent() < 100}>
                <div class="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col gap-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-[var(--foreground)] font-medium">Upload progress</span>
                    <span class="text-[var(--text-secondary)]">{takeoutUploadPercent()}%</span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-[var(--hover-bg)] overflow-hidden">
                    <div class="h-full bg-[var(--primary)] transition-all" style={{ width: `${takeoutUploadPercent()}%` }} />
                  </div>
                </div>
              </Show>

              <Show when={takeoutJob() && takeoutJob()!.estimationInProgress && takeoutJob()!.status !== "running"}>
                <div class="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col gap-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-[var(--foreground)] font-medium">Archive analysis progress</span>
                    <span class="text-[var(--text-secondary)]">
                      <Show when={estimationProgressPercent() !== null} fallback={"Working..."}>
                        {estimationProgressPercent()}%
                      </Show>
                    </span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-[var(--hover-bg)] overflow-hidden">
                    <Show when={estimationProgressPercent() !== null} fallback={
                      <div class="h-full w-1/3 bg-[var(--primary)] animate-pulse" />
                    }>
                      <div class="h-full bg-[var(--primary)] transition-all" style={{ width: `${estimationProgressPercent() ?? 0}%` }} />
                    </Show>
                  </div>
                </div>
              </Show>

              <Show when={takeoutJob()}>
                <div class="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex flex-col gap-4">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-semibold text-[var(--foreground)]">Current Import</h3>
                    <span class={`text-xs uppercase tracking-wider font-semibold px-2 py-1 rounded-full ${importStatusStyle(takeoutJob()!.status)}`}>
                      {takeoutJob()!.status}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div class="p-3 rounded-lg bg-[var(--search-bg)] border border-[var(--border)]">
                      <div class="text-xs text-[var(--text-muted)]">DB Imported</div>
                      <div class="text-lg font-semibold text-[var(--foreground)]">{takeoutJob()!.dbImportedMessages}</div>
                    </div>
                    <div class="p-3 rounded-lg bg-[var(--search-bg)] border border-[var(--border)]">
                      <div class="text-xs text-[var(--text-muted)]">IMAP Synced</div>
                      <div class="text-lg font-semibold text-[var(--foreground)]">{takeoutJob()!.imapSyncedMessages}</div>
                    </div>
                    <div class="p-3 rounded-lg bg-[var(--search-bg)] border border-[var(--border)]">
                      <div class="text-xs text-[var(--text-muted)]">Skipped</div>
                      <div class="text-lg font-semibold text-[var(--foreground)]">{takeoutJob()!.skippedMessages}</div>
                    </div>
                    <div class="p-3 rounded-lg bg-[var(--search-bg)] border border-[var(--border)]">
                      <div class="text-xs text-[var(--text-muted)]">Processed</div>
                      <div class="text-lg font-semibold text-[var(--foreground)]">{takeoutJob()!.processedMessages}</div>
                    </div>
                    <div class="p-3 rounded-lg bg-[var(--search-bg)] border border-[var(--border)]">
                      <div class="text-xs text-[var(--text-muted)]">Errors</div>
                      <div class="text-lg font-semibold text-[var(--foreground)]">{takeoutJob()!.errorCount}</div>
                    </div>
                  </div>

                  <Show when={importProgressPercent() !== null}>
                    <div class="p-3 rounded-lg border border-[var(--border)] bg-[var(--search-bg)] flex flex-col gap-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-[var(--text-muted)]">{importPhaseLabel()}</span>
                        <span class="text-[var(--foreground)] font-semibold">
                          {importProgressPercent()}% ({importProgressDetail()})
                          <Show when={importEtaLabel()}>
                            {` · ETA ${importEtaLabel()}`}
                          </Show>
                        </span>
                      </div>
                      <div class="w-full h-2 rounded-full bg-[var(--hover-bg)] overflow-hidden">
                        <div class="h-full bg-[var(--primary)] transition-all" style={{ width: `${importProgressPercent() ?? 0}%` }} />
                      </div>
                      <Show when={takeoutJob()!.status === "running" && takeoutJob()!.imapSyncedMessages < takeoutJob()!.dbImportedMessages}>
                        <div class="text-xs text-[var(--text-muted)]">
                          Imported to PostgreSQL first, syncing to IMAP in background.
                        </div>
                      </Show>
                    </div>
                  </Show>
                  <Show when={takeoutJob()!.status === "running" && importProgressPercent() === null}>
                    <div class="p-3 rounded-lg border border-[var(--border)] bg-[var(--search-bg)] flex flex-col gap-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-[var(--text-muted)]">Estimating total emails from Takeout archive...</span>
                        <span class="text-[var(--foreground)] font-semibold">
                          <Show when={estimationProgressPercent() !== null} fallback={"Working..."}>
                            {estimationProgressPercent()}%
                          </Show>
                        </span>
                      </div>
                      <div class="w-full h-2 rounded-full bg-[var(--hover-bg)] overflow-hidden">
                        <Show when={estimationProgressPercent() !== null} fallback={
                          <div class="h-full w-1/3 bg-[var(--primary)] animate-pulse" />
                        }>
                          <div class="h-full bg-[var(--primary)] transition-all" style={{ width: `${estimationProgressPercent() ?? 0}%` }} />
                        </Show>
                      </div>
                    </div>
                  </Show>

                  <div class="rounded-lg border border-[var(--border)] bg-[var(--search-bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    Source file: <span class="text-[var(--foreground)] font-medium">{takeoutJob()!.sourceFilename}</span> ({formatBytes(takeoutJob()!.fileSizeBytes)})
                    <Show when={takeoutArchivePartCount() > 1}>
                      <span> · {takeoutArchivePartCount()} split archives detected</span>
                    </Show>
                  </div>

                  <Show when={takeoutJob()!.lastError}>
                    <div class="text-xs text-[var(--destructive)] bg-red-50 border border-red-200 rounded-lg p-3">
                      {takeoutJob()!.lastError}
                    </div>
                  </Show>
                </div>
              </Show>

              <Show when={takeoutError()}>
                <div class="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-[var(--destructive)]">
                  {takeoutError()}
                </div>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === "accounts"}>
            <div class="flex flex-col gap-6">
              <h2 class="text-xl font-semibold text-[var(--foreground)]">Accounts</h2>
              <div class="p-6 rounded-xl border border-[var(--border)] bg-[var(--search-bg)] flex flex-col gap-6">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[#7c4dff] text-white flex items-center justify-center font-bold text-lg overflow-hidden">
                    <Show
                      when={userImage()}
                      fallback={userInitial()}
                    >
                      <img src={userImage()!} alt="Profile avatar" class="w-full h-full object-cover" />
                    </Show>
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-[var(--foreground)]">{profileName() || userName()}</div>
                    <div class="text-xs text-[var(--text-muted)]">{userEmail()}</div>
                  </div>
                  <span class="ml-auto text-xs font-medium text-[#34a853] bg-[#34a853]/10 px-3 py-1 rounded-full">Connected</span>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
                    <div class="text-sm font-semibold text-[var(--foreground)]">Profile picture</div>
                    <p class="text-xs text-[var(--text-muted)]">Upload a local profile image used in this webmail UI.</p>
                    <div class="flex items-center gap-2">
                      <input
                        ref={profileAvatarInputRef}
                        type="file"
                        accept="image/*"
                        class="hidden"
                        onChange={onSelectProfileImage}
                      />
                      <button
                        class="h-9 px-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] cursor-pointer hover:bg-[var(--hover-bg)]"
                        onClick={() => profileAvatarInputRef?.click()}
                        disabled={accountBusy() === "avatar"}
                      >
                        {accountBusy() === "avatar" ? "Uploading..." : "Upload picture"}
                      </button>
                      <button
                        class="h-9 px-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={removeProfileImage}
                        disabled={!userImage() || accountBusy() === "avatar"}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
                    <div class="text-sm font-semibold text-[var(--foreground)]">Display name</div>
                    <input
                      type="text"
                      value={profileName()}
                      onInput={(e) => setProfileName(e.currentTarget.value)}
                      class="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--primary)]"
                    />
                    <button
                      class="h-9 px-4 rounded-lg border-none bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-start"
                      onClick={saveProfileName}
                      disabled={accountBusy() === "name"}
                    >
                      {accountBusy() === "name" ? "Saving..." : "Save name"}
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-6">
                  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
                    <div class="text-sm font-semibold text-[var(--foreground)]">Webmail login password</div>
                    <p class="text-xs text-[var(--text-muted)]">
                      Updates only the password used to sign in to this webmail UI.
                    </p>
                    <p class="text-xs text-[var(--text-muted)]">
                      IMAP/SMTP and other server services are not changed here. To rotate those credentials, update <code>config.env</code> and redeploy the server.
                    </p>
                    <input
                      type="password"
                      value={currentPassword()}
                      onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                      placeholder="Current password"
                      class="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--primary)]"
                    />
                    <input
                      type="password"
                      value={newPassword()}
                      onInput={(e) => setNewPassword(e.currentTarget.value)}
                      placeholder="New password"
                      class="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--primary)]"
                    />
                    <button
                      class="h-9 px-4 rounded-lg border-none bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-start"
                      onClick={changePassword}
                      disabled={accountBusy() === "password"}
                    >
                      {accountBusy() === "password" ? "Updating..." : "Update password"}
                    </button>
                  </div>

                  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-sm font-semibold text-[var(--foreground)]">Two-factor authentication (optional)</div>
                      <span
                        class={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          isTwoFactorEnabled()
                            ? "text-[#34a853] bg-[#34a853]/10"
                            : "text-[var(--text-secondary)] bg-[var(--search-bg)]"
                        }`}
                      >
                        {isTwoFactorEnabled() ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p class="text-xs text-[var(--text-muted)]">
                      Use authenticator app codes when signing in (for example: Google Authenticator, Authy, 1Password, Microsoft Authenticator, or Aegis). Keep backup codes in a safe place.
                    </p>

                    <input
                      type="password"
                      value={twoFactorPassword()}
                      onInput={(e) => setTwoFactorPassword(e.currentTarget.value)}
                      placeholder="Current password (required for 2FA changes)"
                      class="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--primary)]"
                    />

                    <Show
                      when={!isTwoFactorEnabled()}
                      fallback={
                        <div class="flex flex-wrap items-center gap-2">
                          <button
                            class="h-9 px-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] cursor-pointer hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={regenerateBackupCodes}
                            disabled={accountBusy() === "twoFactor"}
                          >
                            {accountBusy() === "twoFactor" ? "Working..." : "Regenerate backup codes"}
                          </button>
                          <button
                            class="h-9 px-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] cursor-pointer hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={downloadBackupCodes}
                            disabled={backupCodes().length === 0}
                          >
                            Download backup codes
                          </button>
                          <button
                            class="h-9 px-4 rounded-lg border border-red-200 bg-red-50 text-sm text-[var(--destructive)] font-semibold cursor-pointer hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={disableTwoFactor}
                            disabled={accountBusy() === "twoFactor"}
                          >
                            {accountBusy() === "twoFactor" ? "Disabling..." : "Disable 2FA"}
                          </button>
                        </div>
                      }
                    >
                      <button
                        class="h-9 px-4 rounded-lg border-none bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-start"
                        onClick={startTwoFactorSetup}
                        disabled={accountBusy() === "twoFactor"}
                      >
                        {accountBusy() === "twoFactor" ? "Starting..." : "Enable 2FA"}
                      </button>
                    </Show>

                    <Show when={twoFactorSetupUri()}>
                      <Show when={twoFactorQrDataUrl()}>
                        <div class="rounded-lg border border-[var(--border)] bg-white p-3 self-start">
                          <img
                            src={twoFactorQrDataUrl()}
                            alt="Two-factor setup QR code"
                            width="224"
                            height="224"
                            class="block w-56 h-56"
                          />
                        </div>
                      </Show>

                      <div class="rounded-lg border border-[var(--border)] bg-[var(--search-bg)] p-3 text-xs text-[var(--text-secondary)] break-all flex flex-col gap-2">
                        <div class="text-[var(--foreground)] font-medium">Setup secret</div>
                        <code>{parseOtpSecret(twoFactorSetupUri()) || "Secret unavailable"}</code>
                        <div>Add this secret to Google Authenticator (or scan the otpauth URI) and verify below.</div>
                        <code>{twoFactorSetupUri()}</code>
                      </div>

                      <div class="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          inputmode="numeric"
                          pattern="[0-9]*"
                          maxlength={8}
                          value={twoFactorSetupCode()}
                          onInput={(e) => setTwoFactorSetupCode(e.currentTarget.value.replace(/\D+/g, ""))}
                          placeholder="Authenticator code"
                          class="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--primary)]"
                        />
                        <button
                          class="h-9 px-4 rounded-lg border-none bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={finishTwoFactorSetup}
                          disabled={accountBusy() === "twoFactor"}
                        >
                          {accountBusy() === "twoFactor" ? "Verifying..." : "Verify and enable"}
                        </button>
                      </div>
                    </Show>

                    <Show when={backupCodes().length > 0}>
                      <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
                        <div class="text-xs font-semibold text-amber-900">Backup codes</div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <For each={backupCodes()}>
                            {(code) => (
                              <code class="text-xs text-amber-900 bg-white border border-amber-200 rounded px-2 py-1">
                                {code}
                              </code>
                            )}
                          </For>
                        </div>
                        <div class="text-[11px] text-amber-900">
                          Each backup code works once. Regenerating replaces all previous codes.
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "blocked"}>
            <div class="flex flex-col gap-6">
              <h2 class="text-xl font-semibold text-[var(--foreground)]">Blocked Senders</h2>
              <p class="text-sm text-[var(--text-muted)]">
                Emails from blocked senders are automatically moved to Trash and hidden from your inbox.
              </p>
              <div class="rounded-xl border border-[var(--border)] bg-[var(--search-bg)] p-4 flex flex-col gap-3">
                <div class="text-sm font-medium text-[var(--foreground)]">Add sender</div>
                <div class="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="sender@example.com"
                    value={newBlockedSenderEmail()}
                    onInput={(e) => setNewBlockedSenderEmail(e.currentTarget.value)}
                    class="h-10 flex-1 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Display name (optional)"
                    value={newBlockedSenderName()}
                    onInput={(e) => setNewBlockedSenderName(e.currentTarget.value)}
                    class="h-10 flex-1 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    class="h-10 px-4 rounded-lg border-none bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleAddBlockedSender}
                    disabled={!newBlockedSenderEmail().trim()}
                  >
                    Block sender
                  </button>
                </div>
              </div>
              <Show
                when={normalizedBlockedSenders().length > 0}
                fallback={
                  <div class="p-8 rounded-xl border border-[var(--border)] bg-[var(--search-bg)] flex flex-col items-center gap-3 text-center">
                    <IconBlock size={32} class="text-[var(--text-muted)]" />
                    <p class="text-sm text-[var(--text-muted)]">No blocked senders</p>
                  </div>
                }
              >
                <div class="rounded-xl border border-[var(--border)] bg-[var(--search-bg)] overflow-hidden">
                  <div class="px-5 py-3 border-b border-[var(--border-light)] flex items-center gap-3">
                    <input
                      type="checkbox"
                      class="mail-checkbox cursor-pointer"
                      checked={allBlockedSelected()}
                      onChange={(e) => toggleSelectAllBlockedSenders(e.currentTarget.checked)}
                    />
                    <span class="text-xs text-[var(--text-muted)]">
                      {selectedBlockedCount() > 0
                        ? `${selectedBlockedCount()} selected`
                        : `${normalizedBlockedSenders().length} total`}
                    </span>
                    <button
                      class="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleBatchUnblockSelected}
                      disabled={selectedBlockedCount() === 0}
                    >
                      Unblock selected
                    </button>
                  </div>
                  <For each={normalizedBlockedSenders()}>
                    {(sender, index) => (
                      <div
                        class={`flex items-center gap-4 px-5 py-4 ${index() > 0 ? "border-t border-[var(--border-light)]" : ""}`}
                      >
                        <input
                          data-testid={`blocked-row-check-${sender.senderEmail}`}
                          type="checkbox"
                          class="mail-checkbox cursor-pointer"
                          checked={selectedBlockedSenders().has(sender.senderEmail)}
                          onChange={(e) => toggleBlockedSenderSelection(sender.senderEmail, e.currentTarget.checked)}
                        />
                        <IconBlock size={16} class="text-[var(--destructive)] shrink-0" />
                        <div class="flex-1 min-w-0">
                          <Show when={sender.displayName}>
                            <div class="text-sm font-medium text-[var(--foreground)] truncate">{sender.displayName}</div>
                          </Show>
                          <div class="text-sm text-[var(--text-muted)] truncate">{sender.senderEmail}</div>
                          <div class="text-xs text-[var(--text-muted)] mt-0.5">
                            Blocked {new Date(sender.blockedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          class="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors shrink-0"
                          onClick={async () => {
                            await unblockSender(sender.senderEmail);
                            setSelectedBlockedSenders((prev) => {
                              const next = new Set(prev);
                              next.delete(sender.senderEmail);
                              return next;
                            });
                            void refetchBlockedSenders();
                            showToast(`Unblocked ${sender.senderEmail}`, "success");
                          }}
                        >
                          Unblock
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === "auto-reply"}>
            <div class="flex flex-col gap-6">
              <div class="flex items-start justify-between gap-3">
                <h2 class="text-xl font-semibold text-[var(--foreground)]">Auto Reply</h2>
              </div>
              <div>
                <p class="text-sm text-[var(--text-muted)]">
                  Automatically reply to incoming emails when you're away. One reply per sender per active period.
                </p>
              </div>

              <div class="rounded-xl border border-[var(--border)] bg-[var(--search-bg)] p-5 flex flex-col gap-5">
                {/* Enable toggle */}
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium text-[var(--foreground)]">Enable auto reply</div>
                    <div class="text-xs text-[var(--text-muted)] mt-0.5">Automatically reply to incoming messages</div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={autoReplyEnabled()}
                    onClick={() => {
                      markAutoReplyInitialized();
                      setAutoReplyEnabled((v) => !v);
                      scheduleAutoReplySave({ immediate: true });
                    }}
                    class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoReplyEnabled() ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                  >
                    <span
                      class={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoReplyEnabled() ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                {/* Date range */}
                <div class="flex flex-col gap-2">
                  <div class="text-sm font-medium text-[var(--foreground)]">Active period <span class="font-normal text-[var(--text-muted)]">(optional)</span></div>
                  <div class="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <div class="flex items-center gap-2 flex-1">
                      <span class="text-xs text-[var(--text-muted)] w-8">From</span>
                      <input
                        type="date"
                        value={autoReplyStartDate()}
                        onInput={(e) => {
                          markAutoReplyInitialized();
                          setAutoReplyStartDate(e.currentTarget.value);
                          scheduleAutoReplySave({ immediate: true });
                        }}
                        class="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div class="flex items-center gap-2 flex-1">
                      <span class="text-xs text-[var(--text-muted)] w-8">Until</span>
                      <input
                        type="date"
                        value={autoReplyEndDate()}
                        onInput={(e) => {
                          markAutoReplyInitialized();
                          setAutoReplyEndDate(e.currentTarget.value);
                          scheduleAutoReplySave({ immediate: true });
                        }}
                        class="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <button
                      class="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors px-2 py-1 shrink-0"
                      onClick={() => {
                        markAutoReplyInitialized();
                        setAutoReplyStartDate("");
                        setAutoReplyEndDate("");
                        scheduleAutoReplySave({ immediate: true });
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <p class="text-xs text-[var(--text-muted)]">Leave blank to reply indefinitely while enabled.</p>
                </div>

                {/* Subject */}
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-[var(--foreground)]">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Out of office: back on Jan 15"
                    value={autoReplySubject()}
                    onInput={(e) => {
                      markAutoReplyInitialized();
                      setAutoReplySubject(e.currentTarget.value);
                      scheduleAutoReplySave();
                    }}
                    class="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  />
                  <p class="text-xs text-[var(--text-muted)]">Leave blank to use "Auto-Reply: &lt;original subject&gt;".</p>
                </div>

                {/* Body */}
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-[var(--foreground)]">Message</label>
                  <div class="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                    {(() => {
                      const _key = autoReplyEditorKey();
                      return (
                        <LexicalEditor
                          initialContent={autoReplyBodyHtml()}
                          placeholder="Write your auto-reply message..."
                          onChange={(html) => {
                            markAutoReplyInitialized();
                            setAutoReplyBodyHtml(html);
                            setAutoReplyBodyText(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
                            scheduleAutoReplySave();
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>

              </div>

              <Show when={autoReplyEnabled()}>
                <div class="rounded-xl border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 flex items-start gap-3">
                  <IconSend size={16} class="text-[var(--primary)] shrink-0 mt-0.5" />
                  <p class="text-sm text-[var(--foreground)]">
                    Auto reply is <strong>active</strong>
                    <Show when={autoReplyStartDate() || autoReplyEndDate()}>
                      {" "}
                      <Show when={autoReplyStartDate()}>from {autoReplyStartDate()}</Show>
                      <Show when={autoReplyStartDate() && autoReplyEndDate()}> </Show>
                      <Show when={autoReplyEndDate()}>until {autoReplyEndDate()}</Show>
                    </Show>
                    . Replies are sent once per sender per active period.
                  </p>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
