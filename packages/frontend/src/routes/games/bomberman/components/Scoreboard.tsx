import { For, Show } from "solid-js";
import { useT } from "~/i18n/useT";
import { Button } from "~/ui";
import type { BombermanMatchState, BombermanMatchRanking } from "@generale/types";

interface ScoreboardProps {
  match: BombermanMatchState;
  rankings: BombermanMatchRanking[];
  players: Array<{ id: string; name: string }>;
  onBackToRoom: () => void;
}

function resolveWinnerLabel(
  winner: { kind: "player"; id: string } | { kind: "team"; id: string } | null,
  players: Array<{ id: string; name: string }>,
): string {
  if (!winner) return "";
  if (winner.kind === "player") {
    return players.find((p) => p.id === winner.id)?.name ?? winner.id.slice(0, 8);
  }
  return winner.id.slice(0, 8);
}

function resolvePlayerName(playerId: string, players: Array<{ id: string; name: string }>): string {
  return players.find((p) => p.id === playerId)?.name ?? playerId.slice(0, 8);
}

export function Scoreboard(props: ScoreboardProps) {
  const { t } = useT();
  const champion = props.match.winner;

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <div class="bg-gray-900 border-2 border-gray-600 p-8 rounded min-w-[340px] text-center pixel-border max-h-[90vh] overflow-y-auto">
        {/* Champion banner */}
        <Show when={champion}>
          <div class="mb-4">
            <div class="text-yellow-400 text-3xl font-bold mb-1">{t("bomberman.matchChampion")}</div>
            <div class="text-white text-2xl font-bold">{resolveWinnerLabel(champion, props.players)}</div>
          </div>
        </Show>

        {/* Final scores */}
        <Show when={props.rankings.length > 0}>
          <h3 class="text-white/70 text-sm uppercase mb-3">{t("bomberman.finalScore")}</h3>
          <div class="space-y-2 mb-6">
            <For each={props.rankings}>
              {(r) => {
                const name =
                  r.competitor.kind === "player"
                    ? resolvePlayerName(r.competitor.id, props.players)
                    : r.competitor.id.slice(0, 8);
                return (
                  <div class="flex justify-between items-center text-white text-lg px-3 py-1.5 bg-white/5 rounded">
                    <span class="flex items-center gap-2">
                      <span class="text-yellow-500 font-bold">#{r.rank}</span>
                      <span>{name}</span>
                    </span>
                    <span class="font-mono">
                      {r.wins}
                      {props.match.targetWins > 1 && (
                        <span class="text-white/50 text-sm ml-1">/ {props.match.targetWins}</span>
                      )}
                    </span>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Round-by-round results */}
        <Show when={props.match.roundResults.length > 0}>
          <h3 class="text-white/70 text-sm uppercase mb-3">{t("bomberman.roundResults")}</h3>
          <div class="space-y-1 mb-6 max-h-[200px] overflow-y-auto">
            <For each={props.match.roundResults}>
              {(rr) => (
                <div class="flex justify-between text-sm text-white/80 px-2 py-1 bg-white/5 rounded">
                  <span>
                    {t("bomberman.round_", { n: String(rr.roundNumber) })}
                    {rr.attempt > 1 && <span class="text-white/40 text-xs ml-1">(replay #{rr.attempt})</span>}
                  </span>
                  <span>
                    {rr.winner
                      ? `${resolveWinnerLabel(rr.winner, props.players)} (${rr.reason === "last_alive" ? t("bomberman.result") : rr.reason})`
                      : t("bomberman.draw")}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Button variant="primary" class="w-full" onClick={props.onBackToRoom}>
          {t("bomberman.backToRoom")}
        </Button>
      </div>
    </div>
  );
}
