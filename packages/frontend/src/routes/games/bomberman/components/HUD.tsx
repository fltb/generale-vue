import { For, Show } from "solid-js";
import { useT } from "~/i18n/useT";
import type { BombermanMatchState } from "@generale/types";
import { ITEM_DISPLAY, itemAccentCss } from "../itemDisplay";

interface ScoreRow {
  label: string;
  wins: number;
  isMatchPoint: boolean;
}

interface HUDProps {
  timeLeft: number;
  aliveCount: number;
  totalPlayers: number;
  playerStats?: {
    bombMax: number;
    bombActive: number;
    blastRadius: number;
    speed: number;
  };
  playerItems?: string[];
  matchState?: BombermanMatchState | null;
  scoreRows?: ScoreRow[];
  colorVision?: "default" | "safe";
  carrying?: boolean;
  actionKeyLabel?: string;
}

export function HUD(props: HUDProps) {
  const { t } = useT();
  const minutes = Math.floor(props.timeLeft / 60);
  const seconds = props.timeLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const stats = props.playerStats;

  const roundLabel = () => {
    const m = props.matchState;
    if (!m || m.format === "single") return "";
    return t("bomberman.round_", { n: String(m.currentRound) });
  };

  return (
    <div class="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Top bar */}
      <div class="flex justify-between text-white text-sm font-mono p-3">
        {/* Left: timer */}
        <div class="bg-black/60 px-3 py-1 rounded">{timeStr}</div>

        {/* Center: score rows + round indicator */}
        <div class="flex flex-col items-center gap-1">
          <Show when={props.matchState && props.matchState.targetWins > 1}>
            <div class="flex gap-3">
              <For each={props.scoreRows}>
                {(row) => (
                  <div
                    class="px-2 py-0.5 rounded text-xs font-bold"
                    classList={{
                      "bg-yellow-500 text-black": row.isMatchPoint,
                      "bg-black/60 text-white": !row.isMatchPoint,
                    }}
                  >
                    {row.label} {row.wins}
                  </div>
                )}
              </For>
            </div>
            <div class="text-[10px] text-white/70">{roundLabel()}</div>
          </Show>
          <Show when={props.matchState && props.matchState.targetWins === 1}>
            <div class="bg-black/60 px-3 py-1 rounded text-xs">
              {props.matchState?.currentRound ? `${t("bomberman.round")} ${props.matchState.currentRound}` : ""}
            </div>
          </Show>
        </div>

        {/* Right: alive count */}
        <div class="bg-black/60 px-3 py-1 rounded">
          {t("bomberman.alive")}: {props.aliveCount}/{props.totalPlayers}
        </div>
      </div>

      {/* Match point flash banner */}
      <Show when={props.scoreRows?.some((r) => r.isMatchPoint)}>
        <div class="text-center">
          <span class="inline-block bg-red-600 text-white text-xs font-bold px-3 py-0.5 rounded animate-pulse">
            {t("bomberman.matchPoint")}
          </span>
        </div>
      </Show>

      {/* Player inventory — bottom-left */}
      <Show when={stats}>
        <div class="fixed bottom-20 left-4 bg-black/70 text-white rounded-lg p-3 text-sm font-mono pointer-events-none">
          <Show when={props.carrying}>
            <div class="mb-2 px-2 py-1 rounded bg-yellow-500 text-black text-xs font-bold animate-pulse">
              {t("bomberman.carryingBomb", { key: props.actionKeyLabel ?? "?" })}
            </div>
          </Show>
          <div class="flex gap-3 mb-2">
            <span>
              {t("bomberman.bombLimit")}: {stats?.bombActive ?? 0}/{stats?.bombMax ?? 0}
            </span>
            <span>
              {t("bomberman.fire")}: {stats?.blastRadius ?? 0}
            </span>
            <span>
              {t("bomberman.speed")}: {stats?.speed ?? 0}
            </span>
          </div>

          {/* Active items */}
          <Show when={props.playerItems && props.playerItems.length > 0}>
            <div class="border-t border-white/20 pt-2 mt-1">
              <div class="flex flex-wrap gap-1">
                <For each={props.playerItems}>
                  {(item) => {
                    const info = ITEM_DISPLAY[item as keyof typeof ITEM_DISPLAY];
                    if (!info) return null;
                    return (
                      <span
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold"
                        style={{
                          background: itemAccentCss(item as keyof typeof ITEM_DISPLAY, props.colorVision ?? "default"),
                          color: "#000",
                        }}
                        title={t(info.descKey)}
                      >
                        {info.label}
                      </span>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
