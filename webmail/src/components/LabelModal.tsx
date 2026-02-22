import { createSignal, Show, For } from "solid-js";
import { IconClose, IconEdit, IconTrash } from "./Icons";
import { labelsState, addLabel, updateLabel, removeLabel, LABEL_COLORS, IMPORTANT_LABEL_NAME, isCategoryLabelName } from "~/lib/labels-store";

interface LabelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LabelModal(props: LabelModalProps) {
  const [newLabelName, setNewLabelName] = createSignal("");
  const [newLabelColor, setNewLabelColor] = createSignal(LABEL_COLORS[0]);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [editingLabel, setEditingLabel] = createSignal<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = createSignal<string | null>(null);

  const handleAddLabel = () => {
    const name = newLabelName().trim();
    if (!name || name.toLowerCase() === IMPORTANT_LABEL_NAME.toLowerCase()) return;
    const created = addLabel(name, newLabelColor());
    if (!created) return;
    setNewLabelName("");
    setNewLabelColor(LABEL_COLORS[0]);
    setShowCreateForm(false);
  };

  const handleDelete = (id: string) => {
    removeLabel(id);
    if (editingLabel() === id) setEditingLabel(null);
    setDeleteConfirmationId(null);
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={props.onClose}>
        <div
          class="bg-[var(--card)] rounded-2xl shadow-2xl w-[600px] max-w-[90vw] flex flex-col max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] shrink-0">
            <h2 class="text-xl font-bold text-[var(--foreground)]">Labels</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm())}
              class="px-4 py-2 rounded-full bg-[var(--primary)] text-white text-sm font-semibold border-none cursor-pointer hover:brightness-110 transition-all"
            >
              + New label
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            {/* Create Form */}
            <Show when={showCreateForm()}>
              <div class="bg-[var(--search-bg)] rounded-xl p-5 mb-6 border border-[var(--border)] animate-in fade-in slide-in-from-top-2 duration-200">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-sm font-bold text-[var(--foreground)]">Create new label</h3>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    class="w-6 h-6 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                  >
                    <IconClose size={16} />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Label name"
                  value={newLabelName()}
                  onInput={(e) => setNewLabelName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
                  class="w-full h-10 px-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none mb-4 focus:border-[var(--primary)] transition-colors"
                  autoFocus
                />

                <div class="flex gap-2 flex-wrap mb-6">
                  <For each={LABEL_COLORS}>
                    {(color) => (
                      <button
                        class={`w-8 h-8 rounded-full border-2 cursor-pointer transition-all ${
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
                  class="px-6 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </Show>

            {/* Labels List */}
            <div class="flex flex-col">
              <div class="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <span>Color</span>
                <span>Name</span>
                <span>Actions</span>
              </div>

              <div class="flex flex-col gap-1">
                <For each={labelsState.labels.filter((label) => label.name !== IMPORTANT_LABEL_NAME && !isCategoryLabelName(label.name))}>
                  {(label) => (
                    <div class="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-3 rounded-xl hover:bg-[var(--hover-bg)] transition-colors group border border-transparent hover:border-[var(--border-light)]">
                      <Show when={editingLabel() === label.id} fallback={
                        <span class="w-4 h-4 rounded-full" style={{ background: label.color }} />
                      }>
                        <div class="flex gap-1 flex-wrap w-32">
                          <For each={LABEL_COLORS}>
                            {(color) => (
                              <button
                                class={`w-4 h-4 rounded-full border border-black/10 cursor-pointer transition-all ${
                                  label.color === color ? "scale-125 ring-1 ring-[var(--foreground)]" : "hover:scale-110"
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
                          class="h-8 px-2 rounded border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] outline-none w-full"
                          autoFocus
                        />
                      </Show>

                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Show when={editingLabel() === label.id} fallback={
                          <button
                            onClick={() => setEditingLabel(label.id)}
                            class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--active-bg)] hover:text-[var(--primary)] transition-colors"
                            title="Edit"
                          >
                            <IconEdit size={16} />
                          </button>
                        }>
                          <button
                            onClick={() => setEditingLabel(null)}
                            class="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white border-none cursor-pointer hover:brightness-110"
                          >
                            Done
                          </button>
                        </Show>
                        <button
                          onClick={() => setDeleteConfirmationId(label.id)}
                          class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-50 hover:text-[var(--destructive)] transition-colors"
                          title="Delete"
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>

        <Show when={deleteConfirmationId()}>
          <div class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setDeleteConfirmationId(null)}>
             <div class="bg-[var(--card)] p-6 rounded-xl shadow-xl w-[400px] max-w-[90vw] border border-[var(--border)]" onClick={e => e.stopPropagation()}>
               <h3 class="text-lg font-bold mb-2 text-[var(--foreground)]">Delete Label?</h3>
               <p class="text-[var(--text-secondary)] mb-6 text-sm">Are you sure you want to delete this label? This action cannot be undone.</p>
               <div class="flex justify-end gap-3">
                 <button
                   onClick={() => setDeleteConfirmationId(null)}
                   class="px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--hover-bg)] text-[var(--foreground)] border border-[var(--border)] cursor-pointer"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={() => handleDelete(deleteConfirmationId()!)}
                   class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 border-none cursor-pointer"
                 >
                   Delete
                 </button>
               </div>
             </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
