import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { useAuth } from "./useAuth";
import { api } from "~/api/base";
import type { GameSettingsSchema } from "@generale/types";

interface UseGameSettings<T extends object> {
  settings: () => T;
  isLoading: () => boolean;
  update: (partial: Partial<T>) => void;
}

export function useGameSettings<T extends object>(
  schema: GameSettingsSchema<T>,
): UseGameSettings<T> {
  const auth = useAuth();
  const qc = useQueryClient();
  const queryKey = ["settings", "game", schema.gameType] as const;

  const query = createQuery(() => ({
    queryKey,
    queryFn: async () => {
      const resp = await api<{ success: boolean; data: T }>(`/api/settings/game/${schema.gameType}`);
      if (!resp.success) throw new Error("Failed to fetch game settings");
      return { ...schema.defaults, ...resp.data };
    },
    enabled: () => !!auth.user,
    initialData: (): T => schema.defaults,
    staleTime: 5 * 60 * 1000,
  }));

  const mutation = createMutation(() => ({
    mutationFn: async (partial: Partial<T>) => {
      const body: Record<string, string> = {};
      for (const [key, value] of Object.entries(partial)) {
        body[key] = schema.serialize(key as keyof T & string, value as T[keyof T & string]);
      }
      return api<{ success: boolean }>(`/api/settings/game/${schema.gameType}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onMutate: async (partial) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<T>(queryKey);
      qc.setQueryData<T>(queryKey, (old) => ({
        ...(old ?? schema.defaults),
        ...partial,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  }));

  return {
    settings: () => query.data ?? schema.defaults,
    isLoading: () => query.isLoading,
    update: (partial) => {
      if (!auth.user) return;
      mutation.mutate(partial);
    },
  };
}
