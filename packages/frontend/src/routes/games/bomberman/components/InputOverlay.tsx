import { Show } from "solid-js";
import type { BombermanDirection } from "@generale/types";
import { useT } from "~/i18n/useT";

interface InputOverlayProps {
  direction: BombermanDirection | null;
  action: "PLACE_BOMB" | "ACTION" | "DETONATE" | null;
}

const DIRECTION_CHARS: Record<BombermanDirection, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

const DIRECTION_ORDER: readonly BombermanDirection[] = ["left", "up", "down", "right"];

const ACTION_KEYS = {
  PLACE_BOMB: "bomberman.placeBomb",
  ACTION: "bomberman.action",
  DETONATE: "bomberman.detonate",
} as const;

export function InputOverlay(props: InputOverlayProps) {
  const { t } = useT();

  return (
    <div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div class="flex gap-2">
        {DIRECTION_ORDER.map((dir) => (
          <div
            class={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg transition-colors ${
              props.direction === dir ? "bg-yellow-400 text-black" : "bg-black/50 text-white/40"
            }`}
          >
            {DIRECTION_CHARS[dir]}
          </div>
        ))}

        <Show when={props.action}>
          {(action) => (
            <div class="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xs bg-cyan-500 text-black transition-colors text-center px-1">
              {t(ACTION_KEYS[action()])}
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
