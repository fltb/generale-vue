import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import { useT } from "~/i18n/useT";
import type { BombermanEvent, BombermanPlayer, ItemType } from "@generale/types";
import { ITEM_DISPLAY } from "../itemDisplay";

/**
 * Max elimination feed entries shown concurrently.
 * Each stays for FEED_DURATION_MS before fading out.
 */
const MAX_FEED = 6;
const FEED_DURATION_MS = 6000;

/** Toast duration for pickup messages. */
const TOAST_DURATION_MS = 3000;

interface FeedEntry {
  id: number;
  event: BombermanEvent;
  /** When this entry was added (performance.now reference). */
  addedAt: number;
}

interface EventFeedProps {
  /** Events to process (will be drained by consume). */
  events: BombermanEvent[];
  /** Consume callback — called after events are displayed. */
  consume: () => void;
  /** Player lookup for names. */
  players: Record<string, BombermanPlayer> | undefined;
  /** Local player id (for highlighting). */
  localPlayerId?: string;
  /** Animation disabled? */
  reducedMotion?: boolean;
}

export function EventFeed(props: EventFeedProps) {
  const { t } = useT();
  const [feedEntries, setFeedEntries] = createSignal<FeedEntry[]>([]);
  const [toast, setToast] = createSignal<FeedEntry | null>(null);
  const [toastVisible, setToastVisible] = createSignal(false);

  // ── Process incoming events ──
  createEffect(() => {
    if (props.events.length === 0) return;
    const events = [...props.events];
    props.consume();

    const now = performance.now();

    const newFeed: FeedEntry[] = [];
    let newToast: FeedEntry | null = null;

    for (const event of events) {
      if (event.type === "elimination") {
        newFeed.push({ id: event.id, event, addedAt: now });
      } else if (event.type === "item_picked_up") {
        newToast = { id: event.id, event, addedAt: now };
      }
    }

    if (newFeed.length > 0) {
      setFeedEntries((prev) => {
        const combined = [...prev, ...newFeed].slice(-MAX_FEED);
        return combined;
      });
    }

    if (newToast) {
      setToast(newToast);
      setToastVisible(true);
    }
  });
  // ── Reap expired feed entries ──
  let reapTimer: ReturnType<typeof setInterval> | undefined;
  createEffect(() => {
    if (feedEntries().length === 0) return;
    if (!reapTimer) {
      reapTimer = setInterval(() => {
        const now = performance.now();
        setFeedEntries((prev) => prev.filter((e) => now - e.addedAt < FEED_DURATION_MS));
      }, 1000);
    }
  });
  onCleanup(() => clearInterval(reapTimer));

  // ── Hide toast after duration ──
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    if (toastVisible() && toast()) {
      toastTimer = setTimeout(() => {
        setToastVisible(false);
      }, TOAST_DURATION_MS);
    }
  });
  onCleanup(() => clearTimeout(toastTimer));

  // ── Render ──

  function playerName(id: string): string {
    const p = props.players?.[id];
    if (p) return p.name ?? id.slice(0, 8);
    return id.slice(0, 8);
  }

  function itemLabel(item: ItemType): string {
    return t(ITEM_DISPLAY[item].nameKey);
  }

  return (
    <div class="fixed top-16 left-3 z-30 flex flex-col-reverse gap-1 pointer-events-none max-w-xs">
      {/* ── Elimination feed ── */}
      <For each={feedEntries()}>
        {(entry) => {
          if (entry.event.type !== "elimination") return null;
          const ev = entry.event;
          const victim = playerName(ev.victimId);
          const isLocal = ev.victimId === props.localPlayerId;

          let message: string;
          if (ev.cause === "surrender") {
            message = t("bomberman.eliminatedSurrender", { victim });
          } else if (ev.cause === "shrink") {
            message = t("bomberman.eliminatedShrink", { victim });
          } else if (ev.killerId && ev.killerId !== ev.victimId) {
            const killer = playerName(ev.killerId);
            message = t("bomberman.eliminatedBy", {
              victim: isLocal ? t("bomberman.youAreDead") : victim,
              killer,
            });
          } else {
            message = t("bomberman.eliminatedSelf", { victim: isLocal ? t("You") : victim });
          }
          return (
            <div
              class="text-xs font-bold px-2 py-1 rounded transition-opacity duration-300"
              classList={{
                "bg-red-700/80 text-white": !isLocal,
                "bg-red-900/90 text-yellow-300": isLocal,
              }}
            >
              {message}
            </div>
          );
        }}
      </For>

      {/* ── Pickup toast ── */}
      <Show when={toastVisible() && toast()}>
        {(tst) => {
          const ev = tst().event;
          if (ev.type !== "item_picked_up") return null;
          const player = playerName(ev.playerId);
          const item = itemLabel(ev.item);
          const icon = ITEM_DISPLAY[ev.item].emoji;
          const isLocalPlayer = ev.playerId === props.localPlayerId;
          return (
            <div
              class="text-xs font-bold px-2 py-1 rounded bg-blue-700/80 text-white flex items-center gap-1.5 transition-opacity duration-300"
              classList={{
                "ring-1 ring-yellow-400/50": isLocalPlayer,
              }}
            >
              <span>{icon}</span>
              {isLocalPlayer
                ? `${t("bomberman.pickedUp", { player: t("You"), item })}`
                : `${t("bomberman.pickedUp", { player, item })}`}
            </div>
          );
        }}
      </Show>
    </div>
  );
}
