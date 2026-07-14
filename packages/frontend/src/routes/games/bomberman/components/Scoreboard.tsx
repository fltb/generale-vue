import { For } from "solid-js";
import { useT } from "~/i18n/useT";
import { Button } from "~/ui";

interface ScoreboardProps {
  players: Array<{ name: string; rank: number }>;
  onBackToRoom: () => void;
}

export function Scoreboard(props: ScoreboardProps) {
  const { t } = useT();
  const sorted = [...props.players].sort((a, b) => a.rank - b.rank);

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <div class="bg-gray-900 border-2 border-gray-600 p-8 rounded min-w-[300px] text-center pixel-border">
        <h2 class="text-2xl text-white font-bold mb-6">{t("bomberman.gameOver")}</h2>
        <div class="space-y-2 mb-6">
          <For each={sorted}>
            {(p) => (
              <div class="flex justify-between text-white text-lg">
                <span>
                  #{p.rank} {p.name}
                </span>
              </div>
            )}
          </For>
        </div>
        <Button variant="primary" class="w-full" onClick={props.onBackToRoom}>
          {t("bomberman.backToRoom")}
        </Button>
      </div>
    </div>
  );
}
