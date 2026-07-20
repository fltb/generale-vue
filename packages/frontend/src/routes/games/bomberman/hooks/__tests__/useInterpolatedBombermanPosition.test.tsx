import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, createSignal, type Accessor } from "solid-js";
import { useInterpolatedBombermanPosition } from "../useInterpolatedBombermanPosition";

// ─── RAF callback-map harness ───
// Stores scheduled animation-frame callbacks in a single slot keyed by a numeric ID.
// Tests manually invoke frames with controlled timestamps.

let rafCallback: ((now: number) => void) | null;
let nextRafId: number;
let currentRafId: number | null;
let cancelCalls: number[];

/** Mock value returned by performance.now() — set before each action under test. */
let mockPerfNow: number;

/** Tick one animation frame at the given timestamp. */
function tickRaf(now: number) {
  mockPerfNow = now;
  const cb = rafCallback;
  rafCallback = null;
  if (cb) cb(now);
}

beforeEach(() => {
  rafCallback = null;
  nextRafId = 0;
  currentRafId = null;
  cancelCalls = [];
  mockPerfNow = 0;

  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    rafCallback = cb;
    const id = ++nextRafId;
    currentRafId = id;
    return id;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    cancelCalls.push(id);
    if (currentRafId === id) {
      rafCallback = null;
      currentRafId = null;
    }
  });
  vi.spyOn(performance, "now").mockImplementation(() => mockPerfNow);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Local type matching the module-private InterpolationTarget ───

interface InterpolationTarget {
  x: number;
  y: number;
  speed: number;
  tickRate: number;
  alive: boolean;
}

// ─── Tests ───

describe("useInterpolatedBombermanPosition", () => {
  it("one tile speed 1 tickRate 10: midpoint at timestamp 50, target at timestamp 100", () => {
    let dispose!: () => void;
    const [target, setTarget] = createSignal<InterpolationTarget>({
      x: 0, y: 0, speed: 1, tickRate: 10, alive: true,
    });
    let pos!: { x: Accessor<number>; y: Accessor<number>; moving: Accessor<boolean> };

    createRoot((d) => {
      dispose = d;
      pos = useInterpolatedBombermanPosition(target);
    });

    // Initial snap: position snapped to (0,0), no RAF scheduled
    expect(pos.x()).toBe(0);
    expect(pos.y()).toBe(0);
    expect(pos.moving()).toBe(false);
    expect(rafCallback).toBeNull();

    // Act: change target — move one tile right
    mockPerfNow = 0;
    setTarget({ x: 1, y: 0, speed: 1, tickRate: 10, alive: true });

    // An animation frame was scheduled
    expect(rafCallback).not.toBeNull();

    // Midpoint at 50 ms (duration = 1 * (1000/10) / 1 = 100 ms)
    tickRaf(50);
    expect(pos.x()).toBeCloseTo(0.5, 5);
    expect(pos.y()).toBe(0);
    expect(pos.moving()).toBe(true);
    // New frame scheduled (progress < 1)
    expect(rafCallback).not.toBeNull();

    // Complete at 100 ms
    tickRaf(100);
    expect(pos.x()).toBe(1);
    expect(pos.y()).toBe(0);
    expect(pos.moving()).toBe(false);
    // No more frames scheduled
    expect(rafCallback).toBeNull();

    dispose();
  });

  it("two tiles speed 2: complete at timestamp 100", () => {
    let dispose!: () => void;
    const [target, setTarget] = createSignal<InterpolationTarget>({
      x: 0, y: 0, speed: 2, tickRate: 10, alive: true,
    });
    let pos!: { x: Accessor<number>; y: Accessor<number>; moving: Accessor<boolean> };

    createRoot((d) => {
      dispose = d;
      pos = useInterpolatedBombermanPosition(target);
    });

    // Initial snap
    expect(pos.x()).toBe(0);
    expect(pos.y()).toBe(0);

    // Move two tiles down
    mockPerfNow = 0;
    setTarget({ x: 0, y: 2, speed: 2, tickRate: 10, alive: true });

    // duration = 2 * (1000/10) / 2 = 100 ms
    tickRaf(100);
    expect(pos.x()).toBe(0);
    expect(pos.y()).toBe(2);
    expect(pos.moving()).toBe(false);
    expect(rafCallback).toBeNull();

    dispose();
  });

  it("unchanged coordinates with speed/tick-rate update schedules no RAF", () => {
    let dispose!: () => void;
    const [target, setTarget] = createSignal<InterpolationTarget>({
      x: 3, y: 5, speed: 1, tickRate: 10, alive: true,
    });
    let pos!: { x: Accessor<number>; y: Accessor<number>; moving: Accessor<boolean> };

    createRoot((d) => {
      dispose = d;
      pos = useInterpolatedBombermanPosition(target);
    });

    // After initial snap, position is (3,5) and no RAF is scheduled
    expect(pos.x()).toBe(3);
    expect(pos.y()).toBe(5);
    expect(rafCallback).toBeNull();

    // Reset mock call counts to zero
    vi.clearAllMocks();

    // Update speed and tickRate only — coordinates unchanged
    setTarget({ x: 3, y: 5, speed: 2, tickRate: 20, alive: true });

    // The effect returns early at the no-coordinate-change guard
    expect(rafCallback).toBeNull();
    expect(pos.x()).toBe(3);
    expect(pos.y()).toBe(5);
    expect(pos.moving()).toBe(false);

    dispose();
  });

  it("diagonal jump snaps immediately", () => {
    let dispose!: () => void;
    const [target, setTarget] = createSignal<InterpolationTarget>({
      x: 0, y: 0, speed: 1, tickRate: 10, alive: true,
    });
    let pos!: { x: Accessor<number>; y: Accessor<number>; moving: Accessor<boolean> };

    createRoot((d) => {
      dispose = d;
      pos = useInterpolatedBombermanPosition(target);
    });

    expect(pos.x()).toBe(0);
    expect(pos.y()).toBe(0);

    // Diagonal: both dx and dy non-zero
    setTarget({ x: 1, y: 1, speed: 1, tickRate: 10, alive: true });

    // Snaps to (1,1) — no animation frame scheduled
    expect(pos.x()).toBe(1);
    expect(pos.y()).toBe(1);
    expect(pos.moving()).toBe(false);
    expect(rafCallback).toBeNull();

    dispose();
  });

  it("oversized jump snaps immediately", () => {
    let dispose!: () => void;
    const [target, setTarget] = createSignal<InterpolationTarget>({
      x: 0, y: 0, speed: 1, tickRate: 10, alive: true,
    });
    let pos!: { x: Accessor<number>; y: Accessor<number>; moving: Accessor<boolean> };

    createRoot((d) => {
      dispose = d;
      pos = useInterpolatedBombermanPosition(target);
    });

    expect(pos.x()).toBe(0);
    expect(pos.y()).toBe(0);

    // Jump 2 tiles right when speed is only 1 — distance (2) > maxStep (1)
    setTarget({ x: 2, y: 0, speed: 1, tickRate: 10, alive: true });

    // Snaps to (2,0) — no animation
    expect(pos.x()).toBe(2);
    expect(pos.y()).toBe(0);
    expect(pos.moving()).toBe(false);
    expect(rafCallback).toBeNull();

    dispose();
  });

  it("unmount cleanup cancels pending RAF", () => {
    let dispose!: () => void;
    const [target, setTarget] = createSignal<InterpolationTarget>({
      x: 0, y: 0, speed: 1, tickRate: 10, alive: true,
    });
    createRoot((d) => {
      dispose = d;
      useInterpolatedBombermanPosition(target);
    });

    // Trigger an animation
    mockPerfNow = 0;
    setTarget({ x: 1, y: 0, speed: 1, tickRate: 10, alive: true });
    expect(rafCallback).not.toBeNull();
    const scheduledId = currentRafId;

    // Unmount
    dispose();

    // cancelAnimationFrame was called with the active RAF id
    expect(cancelCalls).toContain(scheduledId);
    // Callback map is empty
    expect(rafCallback).toBeNull();
  });
});
