import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { useT } from "~/i18n/useT";
import { Button, Alert, Spinner, Badge } from "~/ui";
import { fetchBombermanReplays } from "./api/replays";
import type { BombermanReplaySummary } from "@generale/types";

export function BombermanReplays() {
  const { t } = useT();
  const navigate = useNavigate();
  const [page, setPage] = createSignal(0);
  const pageSize = 20;

  const replaysQuery = useQuery(() => ({
    queryKey: ["bomberman-replays", page(), pageSize] as const,
    queryFn: () => fetchBombermanReplays(pageSize, page() * pageSize),
  }));

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const winnerLabel = (summary: BombermanReplaySummary): string => {
    if (!summary.winner) return t("bomberman.draw") || "Draw";
    return summary.winner.kind === "player" ? summary.winner.id.slice(0, 8) : summary.winner.id;
  };

  const replayErrorText = () => {
    const msg = String(replaysQuery.error ?? "");
    if (msg.includes("REPLAY_CORRUPT")) return t("Replay data is corrupted");
    if (msg.includes("DENIED")) return t("You do not have access to this replay");
    return t("Failed to load replays");
  };

  return (
    <ProtectedRoute>
      <div class="container mx-auto max-w-3xl p-8">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold">{t("bomberman.replays")}</h1>
          <Button variant="ghost" onClick={() => navigate("/bomberman")}>
            {t("bomberman.backToRoom") || "Back to Hub"}
          </Button>
        </div>

        <Show when={replaysQuery.isLoading}>
          <div class="text-center py-16">
            <Spinner size="lg" />
          </div>
        </Show>

        <Show when={replaysQuery.isError}>
          <Alert variant="error" class="mb-4">
            {replayErrorText()}
          </Alert>
        </Show>

        <Show when={replaysQuery.isSuccess && (replaysQuery.data ?? []).length === 0}>
          <div class="text-center py-16 text-base-content/50">
            <p>{t("No replays yet. Complete a match to see it here.")}</p>
          </div>
        </Show>

        <Show when={replaysQuery.isSuccess && (replaysQuery.data ?? []).length > 0}>
          <div class="grid gap-3">
            <For each={replaysQuery.data ?? []}>
              {(replay) => (
                <button
                  type="button"
                  class="flex items-center gap-4 p-4 bg-base-200 rounded-xl pixel-border hover:bg-base-300 transition-colors cursor-pointer"
                  onClick={() => navigate(`/bomberman/replay/${replay.id}`)}
                >
                  <div class="flex-1 min-w-0">
                    <div class="font-bold flex items-center gap-2">
                      <Badge variant="outline" size="sm">
                        {replay.format === "single"
                          ? t("bomberman.single")
                          : replay.format === "bo3"
                            ? t("bomberman.bo3")
                            : t("bomberman.bo5")}
                      </Badge>
                      <span class="text-xs text-base-content/50">
                        {t("{n} round(s)", { n: String(replay.roundCount) })}
                      </span>
                    </div>
                    <div class="text-sm mt-1">
                      {replay.winner ? (
                        <span>{t("bomberman.matchChampion_", { name: winnerLabel(replay) })}</span>
                      ) : (
                        <span class="text-base-content/50">{t("bomberman.draw")}</span>
                      )}
                    </div>
                    <div class="text-xs text-base-content/40 mt-1">{formatDate(replay.createdAt)}</div>
                  </div>
                  <span class="btn pixel-btn btn-primary btn-sm">{t("bomberman.watchGame")}</span>
                </button>
              )}
            </For>
          </div>

          {/* Pagination */}
          <div class="flex gap-2 mt-6 justify-center">
            <Button
              size="sm"
              variant="ghost"
              disabled={page() === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t("Previous")}
            </Button>
            <span class="flex items-center text-sm text-base-content/50 px-3">
              {t("Page {n}", { n: String(page() + 1) })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={(replaysQuery.data ?? []).length < pageSize}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("Next")}
            </Button>
          </div>
        </Show>
      </div>
    </ProtectedRoute>
  );
}
