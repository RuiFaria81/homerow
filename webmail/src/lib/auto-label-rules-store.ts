import { createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";

export type DestinationMatchType = "exact" | "contains" | "regex";
export type DestinationTargetField = "destinationAddress" | "destinationLocalPart" | "destinationPlusTag";
export type LabelResolutionMode = "fixed" | "template";

export interface DestinationLabelRule {
  id: string;
  enabled: boolean;
  priority: number;
  targetField: DestinationTargetField;
  matchType: DestinationMatchType;
  pattern: string;
  caseSensitive: boolean;
  labelMode: LabelResolutionMode;
  labelId: string;
  labelTemplate: string;
}

interface AutoLabelRulesState {
  rules: DestinationLabelRule[];
  stopAfterFirstMatch: boolean;
  autoCreateLabelsFromTemplate: boolean;
}

const [autoLabelRulesState, setAutoLabelRulesState] = createStore<AutoLabelRulesState>({
  rules: [],
  stopAfterFirstMatch: false,
  autoCreateLabelsFromTemplate: true,
});

function looksLikeDestinationRule(input: unknown): input is DestinationLabelRule {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<DestinationLabelRule>;
  return typeof candidate.id === "string" &&
    typeof candidate.enabled === "boolean" &&
    typeof candidate.priority === "number" &&
    typeof candidate.targetField === "string" &&
    typeof candidate.matchType === "string" &&
    typeof candidate.pattern === "string" &&
    typeof candidate.caseSensitive === "boolean" &&
    typeof candidate.labelMode === "string" &&
    typeof candidate.labelId === "string" &&
    typeof candidate.labelTemplate === "string";
}

if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("autoLabelRules");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AutoLabelRulesState> | DestinationLabelRule[] | null;
      if (Array.isArray(parsed)) {
        const rules = parsed.filter(looksLikeDestinationRule);
        if (rules.length > 0) setAutoLabelRulesState("rules", rules);
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.rules)) {
          const rules = parsed.rules.filter(looksLikeDestinationRule);
          if (rules.length > 0) setAutoLabelRulesState("rules", rules);
        }
        if (typeof parsed.stopAfterFirstMatch === "boolean") {
          setAutoLabelRulesState("stopAfterFirstMatch", parsed.stopAfterFirstMatch);
        }
        if (typeof parsed.autoCreateLabelsFromTemplate === "boolean") {
          setAutoLabelRulesState("autoCreateLabelsFromTemplate", parsed.autoCreateLabelsFromTemplate);
        }
      }
    }
  } catch (e) {
    console.error("Failed to load destination label rules", e);
  }
}

createEffect(() => {
  if (typeof window !== "undefined") {
    localStorage.setItem("autoLabelRules", JSON.stringify(autoLabelRulesState));
  }
});

export { autoLabelRulesState };

export const addAutoLabelRule = (partial?: Partial<Omit<DestinationLabelRule, "id">>) => {
  const nextPriority = autoLabelRulesState.rules.length + 1;
  const rule: DestinationLabelRule = {
    id: `dest-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: partial?.enabled ?? true,
    priority: partial?.priority ?? nextPriority,
    targetField: partial?.targetField ?? "destinationAddress",
    matchType: partial?.matchType ?? "exact",
    pattern: partial?.pattern ?? "",
    caseSensitive: partial?.caseSensitive ?? false,
    labelMode: partial?.labelMode ?? "fixed",
    labelId: partial?.labelId ?? "",
    labelTemplate: partial?.labelTemplate ?? "",
  };

  setAutoLabelRulesState(
    produce((state) => {
      state.rules.push(rule);
    })
  );
  return rule.id;
};

export const updateAutoLabelRule = (id: string, updates: Partial<Omit<DestinationLabelRule, "id">>) => {
  setAutoLabelRulesState(
    produce((state) => {
      const idx = state.rules.findIndex((r) => r.id === id);
      if (idx !== -1) {
        state.rules[idx] = { ...state.rules[idx], ...updates };
      }
    })
  );
};

export const removeAutoLabelRule = (id: string) => {
  setAutoLabelRulesState(
    produce((state) => {
      state.rules = state.rules.filter((r) => r.id !== id);
    })
  );
};

export const updateAutoLabelRulesSettings = (updates: Partial<Pick<AutoLabelRulesState, "stopAfterFirstMatch" | "autoCreateLabelsFromTemplate">>) => {
  if (typeof updates.stopAfterFirstMatch === "boolean") {
    setAutoLabelRulesState("stopAfterFirstMatch", updates.stopAfterFirstMatch);
  }
  if (typeof updates.autoCreateLabelsFromTemplate === "boolean") {
    setAutoLabelRulesState("autoCreateLabelsFromTemplate", updates.autoCreateLabelsFromTemplate);
  }
};

