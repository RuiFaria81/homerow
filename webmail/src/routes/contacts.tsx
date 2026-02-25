import { createSignal, createResource, Show, For, createMemo } from "solid-js";
import { A } from "@solidjs/router";
import { fetchAllContacts, deleteContact, type ContactEntry } from "~/lib/mail-client-browser";
import { openCompose } from "~/lib/compose-store";
import { IconBack, IconUsers, IconSearch, IconTrash, IconSend, IconPlus, IconClose } from "~/components/Icons";
import { showToast } from "~/lib/toast-store";

export default function Contacts() {
  const [searchTerm, setSearchTerm] = createSignal("");
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [newEmail, setNewEmail] = createSignal("");
  const [newName, setNewName] = createSignal("");

  const [contactsList, { refetch }] = createResource(async () => {
    return await fetchAllContacts();
  }, { initialValue: [] as ContactEntry[] });

  const filteredContacts = createMemo(() => {
    const term = searchTerm().toLowerCase();
    const list = contactsList() || [];
    if (!term) return list;
    return list.filter(
      (c) =>
        c.email.toLowerCase().includes(term) ||
        (c.displayName || "").toLowerCase().includes(term)
    );
  });

  const getInitial = (contact: ContactEntry) => {
    const name = contact.displayName || contact.email;
    return (name.charAt(0) || "?").toUpperCase();
  };

  const avatarColor = (email: string) => {
    const colors = ["#1967d2", "#c5221f", "#137333", "#b05a00", "#7c4dff", "#ea4335", "#00897b", "#6d4c41"];
    return colors[email.charCodeAt(0) % colors.length];
  };

  const handleAddContact = async () => {
    const email = newEmail().trim();
    if (!email) return;
    // Add via the mail-client server function
    try {
      const { addContactToDb } = await import("~/lib/mail-client-browser");
      await addContactToDb(email, newName().trim() || undefined);
      setNewEmail("");
      setNewName("");
      setShowAddForm(false);
      refetch();
    } catch {
      showToast("Failed to add contact", "error");
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await deleteContact(id);
      refetch();
    } catch {
      showToast("Failed to delete contact", "error");
    }
  };

  const handleCompose = (email: string) => {
    openCompose({ to: [email] });
  };

  return (
    <div class="flex flex-col flex-1 h-full bg-[var(--card)]">
      {/* Header */}
      <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] shrink-0">
        <div class="flex items-center gap-3">
          <A
            href="/"
            class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] no-underline"
          >
            <IconBack size={18} />
          </A>
          <IconUsers size={22} class="text-[var(--primary)]" />
          <h1 class="text-xl font-semibold text-[var(--foreground)]">Contacts</h1>
          <Show when={filteredContacts().length > 0}>
            <span class="text-sm text-[var(--text-muted)]">({filteredContacts().length})</span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm()}
              onInput={(e) => setSearchTerm(e.currentTarget.value)}
              class="h-9 pl-10 pr-4 border border-[var(--border)] rounded-full bg-transparent text-sm text-[var(--foreground)] outline-none transition-all focus:border-[var(--primary)] focus:shadow-sm placeholder:text-[var(--text-muted)]"
            />
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            class="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium border-none cursor-pointer hover:brightness-110 transition-all"
          >
            <IconPlus size={16} />
            Add Contact
          </button>
        </div>
      </div>

      {/* Add contact form */}
      <Show when={showAddForm()}>
        <div class="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--search-bg)]">
          <div class="flex items-center gap-3 max-w-xl">
            <input
              type="email"
              placeholder="Email address"
              value={newEmail()}
              onInput={(e) => setNewEmail(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
              class="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
            <input
              type="text"
              placeholder="Name (optional)"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
              class="w-48 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={handleAddContact}
              disabled={!newEmail().trim()}
              class="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium border-none cursor-pointer hover:brightness-110 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              class="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>
      </Show>

      {/* Contacts list */}
      <div class="flex-1 overflow-y-auto">
        <Show when={!contactsList.loading} fallback={
          <div class="p-6 flex flex-col gap-3">
            <For each={Array(6)}>{() => <div class="skeleton h-14 w-full" />}</For>
          </div>
        }>
          <Show when={filteredContacts().length > 0} fallback={
            <div class="flex flex-col items-center justify-center py-20 text-center text-[var(--text-muted)]">
              <IconUsers size={48} class="text-[var(--border)] mb-4" strokeWidth={1} />
              <h3 class="text-lg font-semibold text-[var(--text-secondary)] mb-1">
                {searchTerm() ? "No contacts found" : "No contacts yet"}
              </h3>
              <p class="text-sm">Contacts are automatically saved when you send emails</p>
            </div>
          }>
            <div class="divide-y divide-[var(--border-light)]">
              <For each={filteredContacts()}>
                {(contact) => (
                  <div class="flex items-center gap-4 px-6 py-3 hover:bg-[var(--hover-bg)] transition-colors group">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      style={{ background: avatarColor(contact.email) }}
                    >
                      {getInitial(contact)}
                    </div>
                    <div class="flex-1 min-w-0">
                      <Show when={contact.displayName}>
                        <div class="text-sm font-semibold text-[var(--foreground)]">{contact.displayName}</div>
                      </Show>
                      <div class={`text-sm ${contact.displayName ? "text-[var(--text-muted)]" : "font-semibold text-[var(--foreground)]"}`}>
                        {contact.email}
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <Show when={contact.frequency > 1}>
                        <span class="text-xs text-[var(--text-muted)] mr-2">{contact.frequency} emails</span>
                      </Show>
                      <button
                        onClick={() => handleCompose(contact.email)}
                        class="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--active-bg)] hover:text-[var(--primary)] transition-all"
                        title="Compose email"
                      >
                        <IconSend size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        class="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-[var(--destructive)] transition-all"
                        title="Delete contact"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
