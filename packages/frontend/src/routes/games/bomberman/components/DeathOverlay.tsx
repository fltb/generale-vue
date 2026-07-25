import { Show } from "solid-js";
import { useT } from "~/i18n/useT";
import type { BombermanEvent, BombermanPlayer } from "@generale/types";

interface DeathOverlayProps {
  /** Local player data (null = not in game). */
  localPlayer: BombermanPlayer | null | undefined;
  /** Local player id. */
  playerId?: string;
  /** Recent events (drained by parent). */
  events: BombermanEvent[];
  /** Player lookup for names. */
  players: Record<string, BombermanPlayer> | undefined;
  /** Reduced motion flag. */
  reducedMotion?: boolean;
  /** Whether room role is spectator (not dead player). */
  isRoomSpectator?: boolean;
}

export function DeathOverlay(props: DeathOverlayProps) {
  const { t } = useT();

  // Find the last elimination event involving the local player
  const elim = (): BombermanEvent | null => {
    if (!props.playerId) return null;
    for (let i = props.events.length - 1; i >= 0; i--) {
      const e = props.events[i];
      if (e.type === "elimination") {
        if (e.victimId === props.playerId) return e;
      }
    }
    return null;
  };

  const alive = () => props.localPlayer?.alive ?? false;
  const showOverlay = () => !alive();
  const elimEvent = elim();

  const killMessage = (): string | null => {
    if (elimEvent?.type !== "elimination") return null;
    if (elimEvent.cause === "surrender") return t("bomberman.youSurrendered");
    if (elimEvent.cause === "shrink") return t("bomberman.killedByShrink");
    if (elimEvent.killerId && elimEvent.killerId !== elimEvent.victimId) {
      const killerName = props.players?.[elimEvent.killerId]?.name ?? elimEvent.killerId.slice(0, 8);
      return t("bomberman.deathBy", { killer: killerName });
    }
    return t("bomberman.youEliminatedSelf");
  };

  return (
    <Show when={showOverlay()}>
      <div
        class="fixed inset-0 z-30 flex flex-col items-center justify-center pointer-events-none bg-black/60"
        style={
          props.reducedMotion
            ? {}
            : { "animation-name": "fadeIn", "animation-duration": "0.5s", "animation-fill-mode": "backwards" }
        }
      >
        <div class="text-center">
          <div class="text-3xl font-bold text-red-400 mb-2">{t("bomberman.youAreDead")}</div>
          <Show when={killMessage()}>
            <div class="text-lg text-white/80 mb-4">{killMessage()}</div>
          </Show>
          <Show when={!props.isRoomSpectator}>
            <div class="text-sm text-white/50 mt-2">{t("bomberman.spectating")}</div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
