import type { JSX } from "solid-js";

import type { BombermanOperation, BombermanDirection } from "@generale/types";
import { useT } from "~/i18n/useT";

interface VirtualControlsProps {
  pressDirection: (sourceId: string, direction: BombermanDirection) => void;
  releaseDirection: (sourceId: string) => void;
  onAction: (op: BombermanOperation) => void;
  layout?: "compact" | "spread";
  haptics?: boolean;
}

function tryHaptics(haptics: boolean) {
  if (!haptics) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  } catch {
    // Vibrate API unavailable; silently ignore
  }
}

function DirectionButton(props: {
  direction: BombermanDirection;
  symbol: string;
  pressDirection: (sourceId: string, direction: BombermanDirection) => void;
  releaseDirection: (sourceId: string) => void;
  haptics: boolean;
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
      aria-label={props.direction}
      class="w-14 h-14 bg-gray-700/80 rounded text-white text-2xl active:bg-gray-500 select-none touch-none"
      onPointerDown={(e) => {
        e.preventDefault();
        const btn = e.currentTarget as HTMLButtonElement;
        btn.setPointerCapture(e.pointerId);
        activePointerIds.add(e.pointerId);
        props.pressDirection(`pointer:${e.pointerId}`, props.direction);
        tryHaptics(props.haptics);
      }}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onLostPointerCapture={handlePointerRelease}
    >
      {props.symbol}
    </button>
  );
}

function ActionButton(props: {
  label: string;
  op: BombermanOperation;
  onAction: (op: BombermanOperation) => void;
  className?: string;
  children?: JSX.Element;
  haptics: boolean;
}) {
  const activePointerIds = new Set<number>();

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    activePointerIds.add(e.pointerId);
    props.onAction(props.op);
    tryHaptics(props.haptics);
  };

  const handlePointerUp = (e: PointerEvent) => {
    activePointerIds.delete(e.pointerId);
  };

  return (
    <button
      type="button"
      aria-label={typeof props.label === "string" ? props.label : undefined}
      class={`select-none touch-none ${props.className ?? ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {props.children ?? props.label}
    </button>
  );
}

export function VirtualControls(props: VirtualControlsProps) {
  const { t } = useT();
  const layout = props.layout ?? "compact";
  const haptics = props.haptics ?? false;

  if (layout === "spread") {
    return (
      <div class="fixed bottom-4 left-4 right-4 flex justify-between pointer-events-none z-50">
        <div class="pointer-events-auto grid grid-cols-3 gap-1">
          <div />
          <DirectionButton
            direction="up"
            symbol="▲"
            pressDirection={props.pressDirection}
            releaseDirection={props.releaseDirection}
            haptics={haptics}
          />
          <div />
          <DirectionButton
            direction="left"
            symbol="◀"
            pressDirection={props.pressDirection}
            releaseDirection={props.releaseDirection}
            haptics={haptics}
          />
          <div class="w-14 h-14" />
          <DirectionButton
            direction="right"
            symbol="▶"
            pressDirection={props.pressDirection}
            releaseDirection={props.releaseDirection}
            haptics={haptics}
          />
          <div />
          <DirectionButton
            direction="down"
            symbol="▼"
            pressDirection={props.pressDirection}
            releaseDirection={props.releaseDirection}
            haptics={haptics}
          />
          <div />
        </div>
        <div class="pointer-events-auto flex flex-col items-center gap-2">
          <ActionButton
            label="💣"
            op={{ type: "PLACE_BOMB" }}
            onAction={props.onAction}
            className="w-16 h-16 bg-red-600/80 rounded-full text-white text-2xl font-bold active:bg-red-400"
            haptics={haptics}
          >
            💣
          </ActionButton>
          <div class="flex gap-2">
            <ActionButton
              label={t("bomberman.action")}
              op={{ type: "ACTION" }}
              onAction={props.onAction}
              className="w-14 h-14 bg-blue-600/80 rounded-lg text-white text-sm font-bold active:bg-blue-400"
              haptics={haptics}
            >
              {t("bomberman.action")}
            </ActionButton>
            <ActionButton
              label={t("bomberman.detonate")}
              op={{ type: "DETONATE" }}
              onAction={props.onAction}
              className="w-14 h-14 bg-purple-600/80 rounded-lg text-white text-xs font-bold active:bg-purple-400"
              haptics={haptics}
            >
              {t("bomberman.detonate")}
            </ActionButton>
          </div>
          <ActionButton
            label={t("bomberman.surrender")}
            op={{ type: "SURRENDER" }}
            onAction={props.onAction}
            className="w-14 h-8 bg-yellow-700/80 rounded text-white text-[10px] font-bold active:bg-yellow-500"
            haptics={haptics}
          >
            {t("bomberman.surrender")}
          </ActionButton>
        </div>
      </div>
    );
  }

  // Compact layout (default)
  return (
    <div class="fixed bottom-4 left-4 right-4 flex justify-between pointer-events-none z-50">
      <div class="pointer-events-auto grid grid-cols-3 gap-1">
        <div />
        <DirectionButton
          direction="up"
          symbol="▲"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
          haptics={haptics}
        />
        <div />
        <DirectionButton
          direction="left"
          symbol="◀"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
          haptics={haptics}
        />
        <div class="w-14 h-14" />
        <DirectionButton
          direction="right"
          symbol="▶"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
          haptics={haptics}
        />
        <div />
        <DirectionButton
          direction="down"
          symbol="▼"
          pressDirection={props.pressDirection}
          releaseDirection={props.releaseDirection}
          haptics={haptics}
        />
        <div />
      </div>
      <div class="pointer-events-auto flex flex-col items-center gap-2">
        <ActionButton
          label="💣"
          op={{ type: "PLACE_BOMB" }}
          onAction={props.onAction}
          className="w-16 h-16 bg-red-600/80 rounded-full text-white text-2xl font-bold active:bg-red-400 select-none touch-none"
          haptics={haptics}
        >
          💣
        </ActionButton>
        <div class="flex gap-2">
          <ActionButton
            label={t("bomberman.action")}
            op={{ type: "ACTION" }}
            onAction={props.onAction}
            className="w-14 h-14 bg-blue-600/80 rounded-lg text-white text-sm font-bold active:bg-blue-400 select-none touch-none"
            haptics={haptics}
          >
            {t("bomberman.action")}
          </ActionButton>
          <ActionButton
            label={t("bomberman.detonate")}
            op={{ type: "DETONATE" }}
            onAction={props.onAction}
            className="w-14 h-14 bg-purple-600/80 rounded-lg text-white text-xs font-bold active:bg-purple-400 select-none touch-none"
            haptics={haptics}
          >
            {t("bomberman.detonate")}
          </ActionButton>
        </div>
        <ActionButton
          label={t("bomberman.surrender")}
          op={{ type: "SURRENDER" }}
          onAction={props.onAction}
          className="w-14 h-8 bg-yellow-700/80 rounded text-white text-[10px] font-bold active:bg-yellow-500 select-none touch-none"
          haptics={haptics}
        >
          {t("bomberman.surrender")}
        </ActionButton>
      </div>
    </div>
  );
}
