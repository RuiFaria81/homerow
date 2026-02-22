// src/lib/labels-store.ts
import { createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";

export interface Label {
  id: string;
  name: string;
  color: string;
}

export const IMPORTANT_FILTER_ID = "important";
export const IMPORTANT_LABEL_NAME = "Important";
export const IMPORTANT_LABEL_COLOR = "#fbbc04";
export const CATEGORY_FILTER_PREFIX = "category:";
export const PRIMARY_CATEGORY_KEY = "primary";
export const DEFAULT_CATEGORY_NAMES = ["Promotions", "Social", "Updates"];
export type CategoryIconId = "inbox" | "tag" | "users" | "info" | "sparkles" | "briefcase" | "cart" | "receipt" | "heart" | "code" | "bolt";

const isImportantName = (name: string) => name.trim().toLowerCase() === IMPORTANT_LABEL_NAME.toLowerCase();
const CATEGORY_LABEL_PATTERN = /^category\s+(.+)$/i;

const toTitleCase = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const normalizeCategoryKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export const getCategoryNameFromLabel = (labelName: string): string | null => {
  const match = CATEGORY_LABEL_PATTERN.exec(labelName.trim());
  if (!match) return null;
  const categoryName = match[1]?.trim();
  return categoryName ? categoryName : null;
};

export const isCategoryLabelName = (labelName: string): boolean => Boolean(getCategoryNameFromLabel(labelName));

export const isCategoryFilterId = (filter: string | null | undefined): boolean =>
  typeof filter === "string" && filter.startsWith(CATEGORY_FILTER_PREFIX);

export const categoryFilterIdFor = (categoryName: string): string =>
  `${CATEGORY_FILTER_PREFIX}${normalizeCategoryKey(categoryName)}`;

export const categoryKeyFromFilterId = (filter: string): string | null => {
  if (!isCategoryFilterId(filter)) return null;
  const key = filter.slice(CATEGORY_FILTER_PREFIX.length).trim();
  return key ? key : null;
};

export const isPrimaryCategoryKey = (key: string | null | undefined): boolean =>
  (key || "").trim().toLowerCase() === PRIMARY_CATEGORY_KEY;

export const formatCategoryName = (value: string): string => toTitleCase(value);
export const normalizeCategoryNameToKey = (value: string): string => normalizeCategoryKey(value);

export interface CategoryTab {
  key: string;
  name: string;
  filterId: string;
  icon: CategoryIconId;
}

export interface CategoryDefinition {
  key: string;
  name: string;
  icon: CategoryIconId;
}

const DEFAULT_CATEGORY_ICON_BY_KEY: Record<string, CategoryIconId> = {
  promotions: "tag",
  social: "users",
  updates: "info",
};

const fallbackCategoryIcon = (key: string): CategoryIconId => DEFAULT_CATEGORY_ICON_BY_KEY[key] || "sparkles";

export const getVisibleLabels = (): Label[] =>
  labelsState.labels.filter((label) => !isCategoryLabelName(label.name));

export const getConfiguredCategories = (): CategoryDefinition[] => labelsState.categories;

export const addCategory = (name: string): string | null => {
  const key = normalizeCategoryKey(name);
  if (!key || isPrimaryCategoryKey(key)) return null;
  const existing = labelsState.categories.find((category) => category.key === key);
  if (existing) return existing.key;

  setLabelsState(
    produce((state) => {
      state.categories.push({
        key,
        name: formatCategoryName(name),
        icon: fallbackCategoryIcon(key),
      });
    })
  );
  return key;
};

export const updateCategory = (key: string, updates: Partial<Pick<CategoryDefinition, "name" | "icon">>): void => {
  const normalizedKey = normalizeCategoryKey(key);
  if (!normalizedKey || isPrimaryCategoryKey(normalizedKey)) return;
  setLabelsState(
    produce((state) => {
      const idx = state.categories.findIndex((category) => category.key === normalizedKey);
      if (idx === -1) return;
      if (updates.name !== undefined && updates.name.trim()) {
        state.categories[idx].name = formatCategoryName(updates.name);
      }
      if (updates.icon !== undefined) {
        state.categories[idx].icon = updates.icon;
      }
    })
  );
};

export const removeCategory = (key: string): void => {
  const normalizedKey = normalizeCategoryKey(key);
  if (!normalizedKey || isPrimaryCategoryKey(normalizedKey)) return;
  setLabelsState(
    produce((state) => {
      state.categories = state.categories.filter((category) => category.key !== normalizedKey);
    })
  );
};

export const getCategoryTabs = (): CategoryTab[] => {
  const tabs: CategoryTab[] = [
    {
      key: PRIMARY_CATEGORY_KEY,
      name: "Inbox",
      filterId: categoryFilterIdFor(PRIMARY_CATEGORY_KEY),
      icon: "inbox",
    },
  ];

  for (const category of labelsState.categories) {
    tabs.push({
      key: category.key,
      name: category.name,
      filterId: categoryFilterIdFor(category.key),
      icon: category.icon,
    });
  }
  return tabs;
};

export const isConfiguredCategoryKey = (categoryKey: string): boolean => {
  const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
  if (!normalizedCategoryKey) return false;
  if (isPrimaryCategoryKey(normalizedCategoryKey)) return true;
  return labelsState.categories.some((category) => category.key === normalizedCategoryKey);
};

export const matchesCategoryFlags = (flags: string[], categoryKey: string): boolean => {
  const configuredKeys = new Set(labelsState.categories.map((category) => category.key));
  if (isPrimaryCategoryKey(categoryKey)) {
    return !flags.some((flag) => {
      const categoryName = getCategoryNameFromLabel(flag);
      if (!categoryName) return false;
      return configuredKeys.has(normalizeCategoryKey(categoryName));
    });
  }

  const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
  if (!configuredKeys.has(normalizedCategoryKey)) return false;
  return flags.some((flag) => normalizeCategoryKey(getCategoryNameFromLabel(flag) || "") === normalizedCategoryKey);
};

const DEFAULT_LABELS: Label[] = [
  { id: "work", name: "Work", color: "#1a73e8" },
  { id: "personal", name: "Personal", color: "#34a853" },
  { id: "finance", name: "Finance", color: "#fbbc04" },
  { id: "travel", name: "Travel", color: "#7c4dff" },
  { id: "shopping", name: "Shopping", color: "#00897b" },
];

interface LabelsState {
  labels: Label[];
  categories: CategoryDefinition[];
  activeFilter: string | null; // label id, "starred", or "important"
}

const [labelsState, setLabelsState] = createStore<LabelsState>({
  labels: DEFAULT_LABELS,
  categories: DEFAULT_CATEGORY_NAMES.map((name) => ({
    key: normalizeCategoryKey(name),
    name: formatCategoryName(name),
    icon: fallbackCategoryIcon(normalizeCategoryKey(name)),
  })),
  activeFilter: null,
});

// Initialize from localStorage
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("labels");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.filter((candidate: unknown): candidate is Label => {
          if (!candidate || typeof candidate !== "object") return false;
          const value = candidate as Record<string, unknown>;
          return typeof value.id === "string" &&
            typeof value.name === "string" &&
            typeof value.color === "string" &&
            !isImportantName(value.name);
        });
        if (normalized.length > 0) {
          setLabelsState("labels", normalized);
        }
      }
    }

    const storedCategories = localStorage.getItem("categories");
    if (storedCategories) {
      const parsedCategories = JSON.parse(storedCategories);
      if (Array.isArray(parsedCategories)) {
        const normalizedCategories = parsedCategories
          .map((candidate: unknown): CategoryDefinition | null => {
            if (typeof candidate === "string") {
              const normalizedKey = normalizeCategoryKey(candidate);
              if (!normalizedKey || isPrimaryCategoryKey(normalizedKey)) return null;
              return {
                key: normalizedKey,
                name: formatCategoryName(candidate),
                icon: fallbackCategoryIcon(normalizedKey),
              };
            }
            if (!candidate || typeof candidate !== "object") return null;
            const value = candidate as Record<string, unknown>;
            if (typeof value.key === "string") {
              const normalizedKey = normalizeCategoryKey(value.key);
              if (!normalizedKey || isPrimaryCategoryKey(normalizedKey)) return null;
              const displayName = typeof value.name === "string" ? value.name : value.key;
              const icon = typeof value.icon === "string" ? value.icon as CategoryIconId : fallbackCategoryIcon(normalizedKey);
              return { key: normalizedKey, name: formatCategoryName(displayName), icon };
            }
            return null;
          })
          .filter((category): category is CategoryDefinition => Boolean(category));
        const uniqueByKey = new Map<string, CategoryDefinition>();
        for (const category of normalizedCategories) {
          uniqueByKey.set(category.key, category);
        }
        setLabelsState("categories", Array.from(uniqueByKey.values()));
      }
    }
  } catch (e) {
    console.error("Failed to load labels", e);
  }
}

// Persist labels to localStorage
createEffect(() => {
  if (typeof window !== "undefined") {
    localStorage.setItem("labels", JSON.stringify(labelsState.labels));
    localStorage.setItem("categories", JSON.stringify(labelsState.categories));
  }
});

export { labelsState };

export const getLabels = () => labelsState.labels;

export const setActiveFilter = (filter: string | null) => {
  setLabelsState("activeFilter", filter);
};

export const addLabel = (name: string, color: string) => {
  if (isImportantName(name)) return null;
  const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
  setLabelsState(
    produce((state) => {
      state.labels.push({ id, name, color });
    })
  );
  return id;
};

export const updateLabel = (id: string, updates: Partial<Omit<Label, "id">>) => {
  setLabelsState(
    produce((state) => {
      const idx = state.labels.findIndex((l) => l.id === id);
      if (idx !== -1) {
        if (isImportantName(state.labels[idx].name)) return;
        if (updates.name !== undefined && isImportantName(updates.name)) return;
        if (updates.name !== undefined) state.labels[idx].name = updates.name;
        if (updates.color !== undefined) state.labels[idx].color = updates.color;
      }
    })
  );
};

export const removeLabel = (id: string) => {
  setLabelsState(
    produce((state) => {
      const target = state.labels.find((l) => l.id === id);
      if (target && isImportantName(target.name)) return;
      state.labels = state.labels.filter((l) => l.id !== id);
    })
  );
};

export const getLabelByName = (name: string) => {
  return labelsState.labels.find((l) => l.name === name);
};

export const LABEL_COLORS = [
  "#ea4335", "#1a73e8", "#34a853", "#fbbc04", "#7c4dff",
  "#00897b", "#e91e63", "#ff5722", "#795548", "#607d8b",
  "#9c27b0", "#3f51b5",
];
