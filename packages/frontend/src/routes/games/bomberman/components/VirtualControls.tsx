import type { BombermanOperation, BombermanDirection } from "@generale/types";
import { useT } from "~/i18n/useT";

interface VirtualControlsProps {
  pressDirection: (sourceId: string, direction: BombermanDirection) => void;
  releaseDirection: (sourceId: string) => void;
  onAction: (op: BombermanOperation) => void;
}

function DirectionButton(props: {
  direction: BombermanDirection;
  symbol: string;
  pressDirection: (sourceId: string, direction: BombermanDirection) => void;
  releaseDirection: (sourceId: string) => void;
}) {
  const activePointerIds = new Set<number>();

  const handlePointerRelease = (e: PointerEvent) => {
    if (activePointerIds.has(e.pointerId)) {
      activePointerIds.delete(e.pointerId);
      const btn = e.currentTarget as HTMLButtonElement;
      // Only release capture if it is still held — otherwise NotFoundError per spec §4.5
      if (btn.hasPointerCapture(e.pointerId)) {
        btn.releasePointerCapture(e.pointerId);
      }
      props.releaseDirection(`pointer:${e.pointerId}`);
    }
  };

  return (
    <button
      type="button"
      class="w-14 h-14 bg-gray-700/80 rounded text-white text-2xl active:bg-gray-500 select-none touch-none"
      onPointerDown={(e) => {
        e.preventDefault();
        const btn = e.currentTarget as HTMLButtonElement;
        btn.setPointerCapture(e.pointerId);
        activePointerIds.add(e.pointerId);
        props.pressDirection(`pointer:${e.pointerId}`, props.direction);
      }}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onLostPointerCapture={handlePointerRelease}
    >
      {props.symbol}
    </button>
  );
}

export function VirtualControls(props: VirtualControlsProps) {
  const { t } = useT();
  return (
    <div class="fixed bottom-4 left-4 right-4 flex justify-between pointer-events-none z-50">
      <div class="pointer-events-auto grid grid-cols-3 gap-1">
        <div />
        <DirectionButton
          direction="up"
          symbol="▲"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
        />
        <div />
        <DirectionButton
          direction="left"
          symbol="◀"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
        />
        <div class="w-14 h-14" />
        <DirectionButton
          direction="right"
          symbol="▶"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
        />
        <div />
        <DirectionButton
          direction="down"
          symbol="▼"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
        />
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
