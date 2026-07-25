import { createEffect, createSignal } from "solid-js";
import type { BombermanEvent, BombermanState } from "@generale/types";

/**
 * Consumes BombermanEvents from the state after initial snapshot, exactly once.
 *
 * On first mount the cursor is set to `eventCounter - 1`, so events that arrived
 * before the hook mounted are NOT replayed. Every subsequent state update yields
 * only events with `id > lastSeenId`.
 */
export function useBombermanEvents(state: () => BombermanState | undefined) {
  let lastSeenId = -1;
  let initialized = false;

  const [pendingEvents, setPendingEvents] = createSignal<BombermanEvent[]>([]);

  createEffect(() => {
    const s = state();
    if (!s) return;

    if (!initialized) {
      lastSeenId = s.eventCounter - 1;
      initialized = true;
      return;
    }

    const events = s.events ?? [];
    const newEvents: BombermanEvent[] = [];

    for (const e of events) {
      if (e.id > lastSeenId) {
        newEvents.push(e);
      }
    }

    if (newEvents.length > 0) {
      lastSeenId = newEvents[newEvents.length - 1].id;
      setPendingEvents((prev) => [...prev, ...newEvents].slice(-20));
    }
  });

  /** Drain and return all pending events since last call. */
  function consume(): BombermanEvent[] {
    const events = pendingEvents();
    if (events.length > 0) {
      setPendingEvents([]);
    }
    return events;
  }

  return {
    /** Signal of unconsumed events. */
    pendingEvents,
    /** Drain pending events. */
    consume,
    /** Whether the cursor has been initialized (events will start flowing). */
    get ready() {
      return initialized;
    },
  };
}
