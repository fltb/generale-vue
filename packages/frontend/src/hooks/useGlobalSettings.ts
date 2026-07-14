import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { useAuth } from "./useAuth";
import { api } from "~/api/base";
import {
  type GlobalSettings,
  GLOBAL_SETTINGS_DEFAULTS,
  GLOBAL_SETTINGS_KEYS,
  serializeGlobalSetting,
  deserializeGlobalSetting,
} from "@generale/types";

const GLOBAL_QUERY_KEY = ["settings", "global"] as const;
const CACHE_PREFIX = "generale.settings.";

interface UseGlobalSettings {
  settings: () => GlobalSettings;
  isLoading: () => boolean;
  update: (partial: Partial<GlobalSettings>) => void;
}

export function useGlobalSettings(): UseGlobalSettings {
  const auth = useAuth();
  const qc = useQueryClient();

  const query = createQuery(() => ({
    queryKey: GLOBAL_QUERY_KEY,
    queryFn: async () => {
      const resp = await api<{ success: boolean; data: GlobalSettings }>("/api/settings/global");
      if (!resp.success) throw new Error("Failed to fetch settings");
      // Cache to localStorage for offline / pre-login
      for (const key of GLOBAL_SETTINGS_KEYS) {
        const val = resp.data[key];
        if (val !== undefined) {
          localStorage.setItem(CACHE_PREFIX + key, serializeGlobalSetting(key, val));
        }
      }
      return resp.data;
    },
    enabled: () => !!auth.user,
    initialData: (): GlobalSettings => {
      if (!auth.user) return GLOBAL_SETTINGS_DEFAULTS;
      const cached: Partial<GlobalSettings> = {};
      for (const key of GLOBAL_SETTINGS_KEYS) {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (raw !== null) {
          const parsed = deserializeGlobalSetting(key, raw);
          if (parsed !== undefined) Object.assign(cached, { [key]: parsed });
        }
      }
      return { ...GLOBAL_SETTINGS_DEFAULTS, ...cached };
    },
    staleTime: 5 * 60 * 1000,
  }));

  const mutation = createMutation(() => ({
    mutationFn: async (partial: Partial<GlobalSettings>) => {
      const body: Record<string, string> = {};
      for (const [key, value] of Object.entries(partial)) {
        body[key] = serializeGlobalSetting(key as keyof GlobalSettings, value as GlobalSettings[keyof GlobalSettings]);
      }
      return api<{ success: boolean }>("/api/settings/global", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onMutate: async (partial) => {
      await qc.cancelQueries({ queryKey: GLOBAL_QUERY_KEY });
      const prev = qc.getQueryData<GlobalSettings>(GLOBAL_QUERY_KEY);
      qc.setQueryData<GlobalSettings>(GLOBAL_QUERY_KEY, (old) => ({
        ...(old ?? GLOBAL_SETTINGS_DEFAULTS),
        ...partial,
      }));
      // Update localStorage cache
      for (const [k, v] of Object.entries(partial)) {
        localStorage.setItem(
          CACHE_PREFIX + k,
          serializeGlobalSetting(k as keyof GlobalSettings, v as GlobalSettings[keyof GlobalSettings]),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(GLOBAL_QUERY_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_QUERY_KEY });
    },
  }));

  return {
    settings: () => query.data ?? GLOBAL_SETTINGS_DEFAULTS,
    isLoading: () => query.isLoading,
    update: (partial) => {
      if (!auth.user) return;
      mutation.mutate(partial);
    },
  };
}
