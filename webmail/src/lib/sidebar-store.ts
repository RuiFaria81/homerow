import { createSignal } from "solid-js";

const [triggerUpdate, setTriggerUpdate] = createSignal(0);
const [folderCounts, setFolderCounts] = createSignal<Record<string, { unread: number; total: number }>>({});

export const refreshCounts = () => {
  setTriggerUpdate((prev) => prev + 1);
};

export const publishFolderCounts = (counts: Record<string, { unread: number; total: number }>) => {
  setFolderCounts(counts);
};

export { triggerUpdate, folderCounts };
