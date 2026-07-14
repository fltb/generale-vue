import type { BombermanOperation } from "@generale/types";
import { useT } from "~/i18n/useT";

interface VirtualControlsProps {
  onAction: (op: BombermanOperation) => void;
}

function createDirectionButton(
  direction: "up" | "down" | "left" | "right",
  symbol: string,
  onAction: (op: BombermanOperation) => void,
) {
  let interval: ReturnType<typeof setInterval> | null = null;

  return (
    <button
      type="button"
      class="w-14 h-14 bg-gray-700/80 rounded text-white text-2xl active:bg-gray-500 select-none touch-none"
      onTouchStart={(e) => {
        e.preventDefault();
        onAction({ type: "MOVE", direction }); // immediate first move
        // Then repeat every 80ms to match server tick rate
        interval = setInterval(() => {
          onAction({ type: "MOVE", direction });
        }, 80);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }}
      onTouchCancel={(e) => {
        e.preventDefault();
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }}
    >
      {symbol}
    </button>
  );
}

export function VirtualControls(props: VirtualControlsProps) {
  const { t } = useT();
  return (
    <div class="fixed bottom-4 left-4 right-4 flex justify-between pointer-events-none z-50">
      <div class="pointer-events-auto grid grid-cols-3 gap-1">
        <div />
        {createDirectionButton("up", "▲", props.onAction)}
        <div />
        {createDirectionButton("left", "◀", props.onAction)}
        <div class="w-14 h-14" />
        {createDirectionButton("right", "▶", props.onAction)}
        <div />
        {createDirectionButton("down", "▼", props.onAction)}
        <div />
      </div>
      <div class="pointer-events-auto flex flex-col items-center gap-2">
        <button
          type="button"
          class="w-16 h-16 bg-red-600/80 rounded-full text-white text-2xl font-bold active:bg-red-400 select-none touch-none"
          onTouchStart={(e) => {
            e.preventDefault();
            props.onAction({ type: "PLACE_BOMB" });
          }}
        >
          💣
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            class="w-14 h-14 bg-blue-600/80 rounded-lg text-white text-sm font-bold active:bg-blue-400 select-none touch-none"
            onTouchStart={(e) => {
              e.preventDefault();
              props.onAction({ type: "ACTION" });
            }}
          >
            {t("bomberman.action")}
          </button>
          <button
            type="button"
            class="w-14 h-14 bg-purple-600/80 rounded-lg text-white text-xs font-bold active:bg-purple-400 select-none touch-none"
            onTouchStart={(e) => {
              e.preventDefault();
              props.onAction({ type: "DETONATE" });
            }}
          >
            {t("bomberman.detonate")}
          </button>
        </div>
        <button
          type="button"
          class="w-14 h-8 bg-yellow-700/80 rounded text-white text-[10px] font-bold active:bg-yellow-500 select-none touch-none"
          onTouchStart={(e) => {
            e.preventDefault();
            props.onAction({ type: "SURRENDER" });
          }}
        >
          {t("bomberman.surrender")}
        </button>
      </div>
    </div>
  );
}
