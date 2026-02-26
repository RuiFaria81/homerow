import { createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { DestinationMatchType, DestinationTargetField } from "./auto-label-rules-store";

export interface DestinationWebhookRule {
  id: string;
  enabled: boolean;
  priority: number;
  targetField: DestinationTargetField;
  matchType: DestinationMatchType;
  pattern: string;
  caseSensitive: boolean;
  endpointUrl: string;
}

interface AutoWebhookRulesState {
  rules: DestinationWebhookRule[];
  stopAfterFirstMatch: boolean;
}

const [autoWebhookRulesState, setAutoWebhookRulesState] = createStore<AutoWebhookRulesState>({
  rules: [],
  stopAfterFirstMatch: false,
});

function looksLikeDestinationWebhookRule(input: unknown): input is DestinationWebhookRule {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<DestinationWebhookRule>;
  return typeof candidate.id === "string" &&
    typeof candidate.enabled === "boolean" &&
    typeof candidate.priority === "number" &&
    typeof candidate.targetField === "string" &&
    typeof candidate.matchType === "string" &&
    typeof candidate.pattern === "string" &&
    typeof candidate.caseSensitive === "boolean" &&
    typeof candidate.endpointUrl === "string";
}

if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("autoWebhookRules");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AutoWebhookRulesState> | DestinationWebhookRule[] | null;
      if (Array.isArray(parsed)) {
        const rules = parsed.filter(looksLikeDestinationWebhookRule);
        if (rules.length > 0) setAutoWebhookRulesState("rules", rules);
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.rules)) {
          const rules = parsed.rules.filter(looksLikeDestinationWebhookRule);
          if (rules.length > 0) setAutoWebhookRulesState("rules", rules);
        }
        if (typeof parsed.stopAfterFirstMatch === "boolean") {
          setAutoWebhookRulesState("stopAfterFirstMatch", parsed.stopAfterFirstMatch);
        }
      }
    }
  } catch (e) {
    console.error("Failed to load destination webhook rules", e);
  }
}

createEffect(() => {
  if (typeof window !== "undefined") {
    localStorage.setItem("autoWebhookRules", JSON.stringify(autoWebhookRulesState));
  }
});

export { autoWebhookRulesState };

export const replaceAutoWebhookRulesState = (next: {
  rules: DestinationWebhookRule[];
  stopAfterFirstMatch: boolean;
}) => {
  setAutoWebhookRulesState("rules", next.rules);
  setAutoWebhookRulesState("stopAfterFirstMatch", next.stopAfterFirstMatch);
};

export const addAutoWebhookRule = (partial?: Partial<Omit<DestinationWebhookRule, "id">>) => {
  const nextPriority = autoWebhookRulesState.rules.length + 1;
  const rule: DestinationWebhookRule = {
    id: `dest-webhook-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: partial?.enabled ?? true,
    priority: partial?.priority ?? nextPriority,
    targetField: partial?.targetField ?? "destinationAddress",
    matchType: partial?.matchType ?? "exact",
    pattern: partial?.pattern ?? "",
    caseSensitive: partial?.caseSensitive ?? false,
    endpointUrl: partial?.endpointUrl ?? "",
  };

  setAutoWebhookRulesState(
    produce((state) => {
      state.rules.push(rule);
    })
  );
  return rule.id;
};

export const updateAutoWebhookRule = (id: string, updates: Partial<Omit<DestinationWebhookRule, "id">>) => {
  setAutoWebhookRulesState(
    produce((state) => {
      const idx = state.rules.findIndex((r) => r.id === id);
      if (idx !== -1) {
        state.rules[idx] = { ...state.rules[idx], ...updates };
      }
    })
  );
};

export const removeAutoWebhookRule = (id: string) => {
  setAutoWebhookRulesState(
    produce((state) => {
      state.rules = state.rules.filter((r) => r.id !== id);
    })
  );
};

export const updateAutoWebhookRulesSettings = (updates: Partial<Pick<AutoWebhookRulesState, "stopAfterFirstMatch">>) => {
  if (typeof updates.stopAfterFirstMatch === "boolean") {
    setAutoWebhookRulesState("stopAfterFirstMatch", updates.stopAfterFirstMatch);
  }
};
