import { getAutoReplySettings, getUnreadCountForSection } from "./mail-client-browser";

export async function getAutoReplySettingsClient() {
  return getAutoReplySettings();
}

export async function getUnreadCountForSectionClient(section: string): Promise<number> {
  return getUnreadCountForSection(section);
}
