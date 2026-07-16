import { describe, expect, it, vi } from "vitest";
import { StateSyncState } from "../state-sync";

describe("StateSyncState", () => {
  it("first send is a snapshot", () => {
    const sync = new StateSyncState<{ x: number }>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    sync.send("p1", false, { x: 1 }, 1, 0, onSnap, onPatch);

    expect(onSnap).toHaveBeenCalledTimes(1);
    expect(onSnap).toHaveBeenCalledWith({ x: 1 }, 1, 0);
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("second send from same pid is a patch", () => {
    const sync = new StateSyncState<{ x: number }>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    sync.send("p1", false, { x: 1 }, 1, 0, () => {}, () => {});
    sync.send("p1", false, { x: 2 }, 2, 1, onSnap, onPatch);

    expect(onPatch).toHaveBeenCalledTimes(1);
    // Should contain a replace patch for /x
    expect(onPatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ op: "replace", path: "/x", value: 2 }),
      ]),
      2,
      1,
    );
    expect(onSnap).not.toHaveBeenCalled();
  });

  it("forceSnapshot overrides patch", () => {
    const sync = new StateSyncState<{ x: number }>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    sync.send("p1", false, { x: 1 }, 1, 0, () => {}, () => {});
    sync.send("p1", true, { x: 2 }, 2, 1, onSnap, onPatch);

    expect(onSnap).toHaveBeenCalledWith({ x: 2 }, 2, 1);
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("clear forces next send to be snapshot", () => {
    const sync = new StateSyncState<{ x: number }>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    sync.send("p1", false, { x: 1 }, 1, 0, () => {}, () => {});
    sync.clear("p1");
    sync.send("p1", false, { x: 2 }, 2, 1, onSnap, onPatch);

    expect(onSnap).toHaveBeenCalledWith({ x: 2 }, 2, 1);
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("clearAll affects all pids", () => {
    const sync = new StateSyncState<{ x: number }>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    // Send to two different pids to establish baselines
    sync.send("p1", false, { x: 1 }, 1, 0, () => {}, () => {});
    sync.send("p2", false, { x: 1 }, 1, 0, () => {}, () => {});
    sync.clearAll();
    // p1 should now send a snapshot (no baseline)
    sync.send("p1", false, { x: 2 }, 2, 1, onSnap, onPatch);

    expect(onSnap).toHaveBeenCalledWith({ x: 2 }, 2, 1);
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("many patches (>1000) triggers snapshot", () => {
    const sync = new StateSyncState<Record<string, number>>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    // Build two states with 1001 differing keys → compare() will produce 1001 patches
    const prev: Record<string, number> = {};
    const curr: Record<string, number> = {};
    for (let i = 0; i < 1001; i++) {
      prev[`k${i}`] = i;
      curr[`k${i}`] = i + 1;
    }

    // Establish baseline
    sync.send("p1", false, prev, 1, 0, () => {}, () => {});
    onSnap.mockClear();
    onPatch.mockClear();

    // 1001 patches > MAX_PATCHES (1000) → snapshot
    sync.send("p1", false, curr, 2, 1, onSnap, onPatch);

    expect(onSnap).toHaveBeenCalledWith(curr, 2, 1);
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("unchanged state produces empty patches", () => {
    const sync = new StateSyncState<{ x: number }>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    sync.send("p1", false, { x: 1 }, 1, 0, () => {}, () => {});
    sync.send("p1", false, { x: 1 }, 2, 1, onSnap, onPatch);

    // compare(prev, same) returns [] → patches.length (0) <= MAX_PATCHES → onPatch([])
    expect(onPatch).toHaveBeenCalledWith([], 2, 1);
    expect(onSnap).not.toHaveBeenCalled();
  });

  it("confirmedOp and version are passed through", () => {
    const sync = new StateSyncState<{ x: number }>();
    const onSnap = vi.fn();
    const onPatch = vi.fn();

    // Snapshot path — send with forceSnapshot
    sync.send("p1", true, { x: 1 }, 42, 7, onSnap, onPatch);
    expect(onSnap).toHaveBeenCalledWith({ x: 1 }, 42, 7);

    onSnap.mockClear();
    onPatch.mockClear();

    // Patch path — establish baseline then send with different version/confirmedOp
    sync.send("p1", false, { x: 1 }, 1, 0, () => {}, () => {});
    sync.send("p1", false, { x: 2 }, 99, 55, onSnap, onPatch);
    expect(onPatch).toHaveBeenCalledWith(expect.any(Array), 99, 55);
  });
});
