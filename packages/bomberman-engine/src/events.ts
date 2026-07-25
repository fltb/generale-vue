import type { BombermanEvent } from "@generale/types";

/** Maximum events kept in the ring buffer. */
export const MAX_EVENTS = 128;

/** Write an event into the state ring buffer (drops oldest if full). */
export function pushEvent(
  events: BombermanEvent[],
  eventCounter: number,
  tick: number,
  event: Record<string, unknown>,
): { events: BombermanEvent[]; eventCounter: number } {
  const id = eventCounter;
  const full = { id, tick, ...event } as BombermanEvent;
  const next = events.length >= MAX_EVENTS ? events.slice(1) : events;
  next.push(full);
  return { events: next, eventCounter: id + 1 };
}
