import { describe, expect, it, vi } from "vitest";
import { displaceConnector } from "../connector-manager";
import { StateSyncState } from "../state-sync";

function createMockConnector() {
  return {
    send: vi.fn(),
    close: vi.fn(),
  };
}

type Connector = ReturnType<typeof createMockConnector>;

describe("displaceConnector", () => {
  const pid = "player-1";
  const customEventType = "server_event";
  const displacedPayloadType = "DISPLACED";

  it("displaces stale connector: old gets DISPLACED message then closed", () => {
    const connectors = new Map<string, Connector>();
    const stateSync = new StateSyncState();
    const syncData = new Map<string, { lastConfirmedOp: number }>();

    const stale = createMockConnector();
    connectors.set(pid, stale);
    const fresh = createMockConnector();

    displaceConnector(
      pid,
      fresh,
      connectors,
      stateSync,
      syncData,
      customEventType,
      displacedPayloadType,
    );

    // old connector receives DISPLACED message
    expect(stale.send).toHaveBeenCalledTimes(1);
    expect(stale.send).toHaveBeenCalledWith({
      type: customEventType,
      payload: { type: displacedPayloadType },
    });

    // old connector is closed
    expect(stale.close).toHaveBeenCalledTimes(1);

    // new connector is in map
    expect(connectors.get(pid)).toBe(fresh);
  });

  it("no existing connector: no displacement", () => {
    const connectors = new Map<string, Connector>();
    const stateSync = new StateSyncState();
    const syncData = new Map<string, { lastConfirmedOp: number }>();

    const fresh = createMockConnector();

    displaceConnector(
      pid,
      fresh,
      connectors,
      stateSync,
      syncData,
      customEventType,
      displacedPayloadType,
    );

    // new connector is in map
    expect(connectors.get(pid)).toBe(fresh);

    // nothing untoward happens with send/close
    // (no stale connector to call them on)
  });

  it("same connector: no displacement", () => {
    const connectors = new Map<string, Connector>();
    const stateSync = new StateSyncState();
    const syncData = new Map<string, { lastConfirmedOp: number }>();

    const conn = createMockConnector();
    connectors.set(pid, conn);

    displaceConnector(
      pid,
      conn,
      connectors,
      stateSync,
      syncData,
      customEventType,
      displacedPayloadType,
    );

    // no send or close called — same connector object
    expect(conn.send).not.toHaveBeenCalled();
    expect(conn.close).not.toHaveBeenCalled();

    // connector remains in map
    expect(connectors.get(pid)).toBe(conn);
  });

  it("clears stateSync for the pid", () => {
    const connectors = new Map<string, Connector>();
    const stateSync = new StateSyncState();
    const syncData = new Map<string, { lastConfirmedOp: number }>();

    // plant a baseline for the pid
    stateSync.prevSentState.set(pid, { some: "state" });
    expect(stateSync.prevSentState.has(pid)).toBe(true);

    const stale = createMockConnector();
    connectors.set(pid, stale);
    const fresh = createMockConnector();

    displaceConnector(
      pid,
      fresh,
      connectors,
      stateSync,
      syncData,
      customEventType,
      displacedPayloadType,
    );

    // baseline removed
    expect(stateSync.prevSentState.has(pid)).toBe(false);
  });

  it("deletes syncData for the pid", () => {
    const connectors = new Map<string, Connector>();
    const stateSync = new StateSyncState();
    const syncData = new Map<string, { lastConfirmedOp: number }>();

    // plant a syncData entry
    syncData.set(pid, { lastConfirmedOp: 42 });
    expect(syncData.has(pid)).toBe(true);

    const stale = createMockConnector();
    connectors.set(pid, stale);
    const fresh = createMockConnector();

    displaceConnector(
      pid,
      fresh,
      connectors,
      stateSync,
      syncData,
      customEventType,
      displacedPayloadType,
    );

    // entry removed
    expect(syncData.has(pid)).toBe(false);
  });

  it("returns the stale connector", () => {
    const connectors = new Map<string, Connector>();
    const stateSync = new StateSyncState();
    const syncData = new Map<string, { lastConfirmedOp: number }>();

    // with stale connector
    const stale = createMockConnector();
    connectors.set(pid, stale);
    const fresh = createMockConnector();

    const result = displaceConnector(
      pid,
      fresh,
      connectors,
      stateSync,
      syncData,
      customEventType,
      displacedPayloadType,
    );
    expect(result).toBe(stale);

    // without stale connector — returns undefined
    connectors.delete(pid);
    const another = createMockConnector();
    const result2 = displaceConnector(
      pid,
      another,
      connectors,
      stateSync,
      syncData,
      customEventType,
      displacedPayloadType,
    );
    expect(result2).toBeUndefined();
  });

  it("error in send does not block close", () => {
    const connectors = new Map<string, Connector>();
    const stateSync = new StateSyncState();
    const syncData = new Map<string, { lastConfirmedOp: number }>();

    const stale = createMockConnector();
    stale.send = vi.fn().mockImplementation(() => {
      throw new Error("send failed");
    });
    connectors.set(pid, stale);
    const fresh = createMockConnector();

    expect(() =>
      displaceConnector(
        pid,
        fresh,
        connectors,
        stateSync,
        syncData,
        customEventType,
        displacedPayloadType,
      ),
    ).not.toThrow();

    // send was attempted (and threw)
    expect(stale.send).toHaveBeenCalledTimes(1);

    // close still called despite send error
    expect(stale.close).toHaveBeenCalledTimes(1);

    // new connector is in map
    expect(connectors.get(pid)).toBe(fresh);
  });
});
