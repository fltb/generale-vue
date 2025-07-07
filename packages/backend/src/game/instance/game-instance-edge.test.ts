// game-instance-edge.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import {
  type GameState,
  type MaskedGameState,
  type PlayerId,
  type SyncedGameClientActions, // Corrected import
  SyncedGameClientActionTypes, // Corrected import
  type SyncedGameServerEvent, // Corrected import
  SyncedGameServerStateUpdatePayloadType, // Corrected import
  PlayerStatus,
  type ServerSyncConnector, // Added for type consistency
  TileType,
  SyncedStateServerEventType,
  SyncedStateServerStateUpdatePayloadType,
  SyncedGameServerEventType,
  PlayerOperation,
  PlayerOperationType, // Added for type consistency
} from "@generale/types";
import { mask, tick } from "../core";
import { GameInstance, GameInstanceSettings } from "./GameInstance";

// --- MockConnector 与辅助函数 ---
class MockServerSyncConnector implements ServerSyncConnector<SyncedGameClientActions, SyncedGameServerEvent> { // Renamed and typed
  public sent: SyncedGameServerEvent[] = [];
  private openCbs: (() => void)[] = [];
  private msgCbs: ((evt: SyncedGameClientActions) => void)[] = []; // Typed
  private closeCbs: ((code: number, reason: string) => void)[] = [];
  private discCbs: ((err?: Error) => void)[] = [];
  private recCbs: (() => void)[] = [];

  readonly ready = true;
  send(evt: SyncedGameServerEvent): void { // Typed
    this.sent.push(evt);
  }
  onOpen(cb: () => void) { this.openCbs.push(cb); }
  onClientMessage(cb: (evt: SyncedGameClientActions) => void) { this.msgCbs.push(cb); } // Typed
  onClose(cb: (code: number, reason: string) => void) { this.closeCbs.push(cb); }
  onDisconnect(cb: (err?: Error) => void) { this.discCbs.push(cb); }
  onReconnect(cb: () => void) { this.recCbs.push(cb); }
  // Implement the missing 'close' method
  close(code?: number, reason?: string): void {
    this.closeCbs.forEach(cb => cb(code || 1000, reason || ""));
  }

  triggerOpen() { this.openCbs.forEach(cb => cb()); }
  triggerClient(evt: SyncedGameClientActions) { this.msgCbs.forEach(cb => cb(evt)); } // Typed
  triggerClose(code = 0, reason = "") { this.closeCbs.forEach(cb => cb(code, reason)); }
  triggerDisconnect(err?: Error) { this.discCbs.forEach(cb => cb(err)); }
  triggerReconnect() { this.recCbs.forEach(cb => cb()); }

  clearSent() { this.sent = []; }
}

// Minimal 2x1 initial state helper
function createInitialState(): GameState {
  return {
    tick: 0,
    settings: {
      afkThreshold: 5,
      tileGrow: {
        PLAIN: { duration: 1, growth: 1 },
        THRONE: { duration: 1, growth: 1 },
        BARRACKS: { duration: 1, growth: 1 },
        MOUNTAIN: { duration: Infinity, growth: 0 },
        SWAMP: { duration: 1, growth: -1 },
        FOG: { duration: Infinity, growth: 0 },
      },
    },
    players: {
      A: { id: "A", status: PlayerStatus.Playing, army: 0, land: 0, lastActiveTick: 0, teamId: "teamA" },
      B: { id: "B", status: PlayerStatus.Playing, army: 0, land: 0, lastActiveTick: 0, teamId: "teamB" },
    },
    teams: {
      teamA: { id: "teamA", memberIds: ["A"], status: PlayerStatus.Playing },
      teamB: { id: "teamB", memberIds: ["B"], status: PlayerStatus.Playing },
    },
    map: {
      width: 2,
      height: 1,
      tiles: [[
        { type: TileType.Plain, ownerId: "A", army: 5 },
        { type: TileType.Plain, ownerId: "B", army: 3 },
      ]],
    },
  };
}

let connectorA: MockServerSyncConnector, connectorB: MockServerSyncConnector, inst: GameInstance;
const pidA: PlayerId = "A", pidB: PlayerId = "B";

beforeEach(() => {
  connectorA = new MockServerSyncConnector();
  connectorB = new MockServerSyncConnector();
  const init = createInitialState();
  const settings: GameInstanceSettings = { playerDisplay: { A: { tileColor: 0xff0000 }, B: { tileColor: 0x0000ff } } };
  inst = new GameInstance(init, settings, new Map([
    [pidA, connectorA], // Typed connectors
    [pidB, connectorB], // Typed connectors
  ]));
});

// 1. advance with empty queues only increments tick
it("1. advance with empty queues only increments tick", () => {
  const t0 = inst.getState().tick;
  inst.advance();
  expect(inst.getState().tick).toBe(t0 + 1);
});

it("2. open → disconnect → reconnect 会触发两次快照", () => {
  connectorA.clearSent();
  connectorA.triggerOpen();       // 第一次 open
  connectorA.triggerDisconnect(); // 意外断开
  connectorA.triggerReconnect();  // 重连
  expect(connectorA.sent.length).toBe(2);
  expect(connectorA.sent[0]?.payload.type).toBe(SyncedStateServerStateUpdatePayloadType.SNAPSHOT); // Corrected type access
  expect(connectorA.sent[1]?.payload.type).toBe(SyncedStateServerStateUpdatePayloadType.SNAPSHOT); // Corrected type access
});

// 3. confirmedOp updates when queue drains
it("3. confirmedOp updates when queue drains", () => {
  connectorA.clearSent();
  // push two ops
  connectorA.triggerClient({
    type: SyncedGameClientActionTypes.PUSH, // Corrected client message type
    optimisticId: 5,
    payload: [
      { type: PlayerOperationType.Move, payload: {from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 }},
      { type: PlayerOperationType.Move, payload: {from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50} },
    ]
  });
  inst.advance();
  let evt = connectorA.sent.at(-1)!;
  // ConfirmedOp should be the last processed operation's optimisticId.
  // Given only one operation is consumed per tick, it should be 5.
  expect(evt.type).toBe(SyncedGameServerEventType.STATE_UPDATE); // It's a snapshot with confirmedOp
  expect(evt.payload.type).toBe(SyncedGameServerStateUpdatePayloadType.SNAPSHOT);
  expect(evt.payload.confirmedOp).toBe(5);
  inst.advance();
  evt = connectorA.sent.at(-1)!;
  // ConfirmedOp should be the last processed operation's optimisticId.
  // Given only one operation is consumed per tick, it should be 5.
  expect(evt.type).toBe(SyncedGameServerEventType.STATE_UPDATE); // It's a patch with confirmedOp
  expect(evt.payload.type).toBe(SyncedGameServerStateUpdatePayloadType.PATCH);
  expect(evt.payload.confirmedOp).toBe(5);
});

// 4. multiple onReconnect force snapshots
it("4. multiple onReconnect force snapshots", () => {
  connectorA.clearSent();
  connectorA.triggerDisconnect();
  connectorA.triggerReconnect();
  connectorA.triggerReconnect(); // Subsequent reconnects should not trigger new snapshots if already connected
  expect(connectorA.sent.every(e => e.payload.type === SyncedStateServerStateUpdatePayloadType.SNAPSHOT)).toBe(true); // Corrected type access
  expect(connectorA.sent.length).toBe(1); // Only one snapshot for the initial reconnect
});

// ... existing code ...

// 5. concurrent client ops during advance *do* patch the playerOperationQueue
it("5. concurrent client ops during advance do patch the playerOperationQueue", () => {
  const op: PlayerOperation = { optimisticId: 1, type: PlayerOperationType.Move, payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 } };

  // Store initial state to compare later
  const initialSyncedState = inst['syncData'].get('A')!.syncedState;

  // Wrap the internal sendState method to inject a client operation during state synchronization
  // Note: Cast 'inst' to 'any' to access private/protected methods for testing purposes.
  const originalSendState = (inst as any)['sendState'];
  let injected = false;
  (inst as any)['sendState'] = (pid: PlayerId, forceSnapshot = false) => {
    // Only inject once for player A during their first sendState call within this advance
    if (pid === 'A' && !injected) {
      connectorA.triggerClient({ optimisticId: 1, type: SyncedGameClientActionTypes.PUSH, payload: [op] });
      injected = true;
    }
    // Call the original sendState method
    originalSendState.call(inst, pid, forceSnapshot);
  };

  inst.advance();

  // The last message sent to connectorA should be a patch
  const lastMessage = connectorA.sent.at(-1)!;
  expect(lastMessage.type).toBe(SyncedGameServerEventType.STATE_UPDATE);
  expect(lastMessage.payload.type).toBe(SyncedGameServerStateUpdatePayloadType.PATCH);

  const patches = (lastMessage.payload as any).payload;

  // Expect that the patch *includes* changes to playerOperationQueue
  // because the operation was injected and processed by handleClientEvent
  // before the patch was calculated for this player.
  expect(patches.some((p: any) => p.path.includes("playerOperationQueue"))).toBe(true);

  // Expect the playerOperationQueue to now contain the injected operation (its ID)
  // Assuming the patch includes the actual value for the path, or a specific path indicates an addition.
  // This might need more specific checks depending on the patch structure.
  // For simplicity, let's just check if it contains *a* change for the queue.
  // If the patch value represents the new queue, you might expect its length to change or content.
  // For now, simply asserting its presence in the patch.

  // Also ensure confirmedOp exists and is updated
  expect(lastMessage.payload).toHaveProperty("confirmedOp");
  expect((lastMessage.payload as any).confirmedOp).toBeGreaterThanOrEqual(op.optimisticId);


  // Restore original method after the test
  (inst as any)['sendState'] = originalSendState;
});

// 6. only connected players get updates
it("6. only connected players get updates", () => {
  connectorB.triggerClose(0, ""); // B closes connection
  connectorA.clearSent(); connectorB.clearSent();
  inst.advance();
  expect(connectorA.sent.length).toBe(1); // A gets an update
  expect(connectorB.sent.length).toBe(0); // B does not
});

// 7. invalid ops do not bump confirmedOp
it("7. invalid ops do not bump confirmedOp", () => {
  connectorA.clearSent();
  connectorA.triggerClient({
    type: "operations", // Corrected client message type
    payload: [
      { optimisticId: 9, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 5, y: 5 }, percentage: 50 } } // Invalid destination
    ]
  });
  inst.advance();
  const evt = connectorA.sent.at(-1)!;
  expect(evt.type).toBe("patch"); // Expect a patch
  expect(evt.payload.confirmedOp).toBe(0); // confirmedOp should remain 0 for an invalid op
});

// 8. multi-tick queue consumption
it("8. multi-tick queue consumption", () => {
  connectorA.triggerClient({
    type: "operations", // Corrected client message type
    payload: [
      { optimisticId: 11, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 } },
      { optimisticId: 12, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 } },
    ]
  });
  inst.advance(); // Consumes op 11, confirmedOp becomes 11
  let meta = (inst as any).syncData.get(pidA).playerOperationQueue; // Corrected internal property access
  expect(meta.length).toBe(1); // One op left in queue
  expect(connectorA.sent.at(-1)!.payload.confirmedOp).toBe(11); // Confirmed for 11

  inst.advance(); // Consumes op 12, confirmedOp becomes 12
  meta = (inst as any).syncData.get(pidA).playerOperationQueue; // Corrected internal property access
  expect(meta.length).toBe(0); // Queue should be empty
  expect(connectorA.sent.at(-1)!.payload.confirmedOp).toBe(12); // Confirmed for 12
});

// 9. team vision fresh capture
it("9. team vision fresh capture", () => {
  // GameInstance uses the mask function which handles team vision.
  // This test primarily checks that `getMaskedState` doesn't alter the original state.
  // Detailed team vision logic should be in `mask.test.ts`.
  const originalState = JSON.parse(JSON.stringify(inst.getState())); // Deep copy
  const maskedState = inst.getMaskedState(pidA);
  // Verify that a masked state is returned and it's not the same object as the original
  expect(maskedState).toBeDefined();
  expect(maskedState).not.toBe(originalState);
  // Verify that the original state is unchanged (purity of mask)
  expect(inst.getState()).toEqual(originalState);
});

// 10. multiple client messages in one tick are all queued
it("10. multiple client messages in one tick are all queued", () => {
  connectorA.triggerClient({ type: "operations", payload: [{ optimisticId: 21, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 } }] });
  connectorA.triggerClient({ type: "operations", payload: [{ optimisticId: 22, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 } }] });
  inst.advance(); // Only one operation (21) should be processed per advance
  const queue = (inst as any).syncData.get(pidA).playerOperationQueue; // Corrected internal property access
  expect(queue.length).toBe(1); // One operation (22) should still be in the queue
  expect(connectorA.sent.at(-1)!.payload.confirmedOp).toBe(21); // Confirmed for 21
});

// 11. no connectors yields no errors
it("11. no connectors yields no errors", () => {
  const empty = new GameInstance(createInitialState(), { playerDisplay: {} }, new Map());
  expect(() => empty.advance()).not.toThrow();
});

// 12. mask is pure
it("12. mask is pure", () => {
  const before = JSON.stringify(inst.getState());
  inst.getMaskedState(pidA);
  expect(JSON.stringify(inst.getState())).toBe(before);
});

// 13. simultaneous multi-player battles
it("13. simultaneous multi-player battles", () => {
  // Set up scenario: A and B both try to attack the same neutral tile (or each other's tile).
  // Let's modify initial state to have a neutral tile for more predictable outcome.
  const customInitialState = createInitialState();
  customInitialState.map.tiles[0][0] = { type: "PLAIN", ownerId: null, army: 1 }; // Neutral tile
  customInitialState.map.tiles[0][1] = { type: "PLAIN", ownerId: "B", army: 3 }; // B's tile
  // A attacks neutral [0][0], B attacks neutral [0][0] from their respective starting points.
  // For this test, let's assume A and B are next to the neutral tile.
  customInitialState.map.width = 3;
  customInitialState.map.tiles[0].push({ type: "PLAIN", ownerId: null, army: 1 }); // new tile at [0,2]
  customInitialState.map.tiles[0][0] = { type: "PLAIN", ownerId: "A", army: 5 };
  customInitialState.map.tiles[0][1] = { type: "PLAIN", ownerId: null, army: 1 }; // neutral
  customInitialState.map.tiles[0][2] = { type: "PLAIN", ownerId: "B", army: 3 };

  inst = new GameInstance(customInitialState, {}, new Map([
    [pidA, connectorA],
    [pidB, connectorB],
  ]));

  connectorA.triggerClient({ type: "operations", payload: [{ optimisticId: 31, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, percentage: 100 } }] });
  connectorB.triggerClient({ type: "operations", payload: [{ optimisticId: 41, type: "MOVE", payload: { from: { x: 0, y: 2 }, to: { x: 0, y: 1 }, percentage: 100 } }] });

  inst.advance();
  // after battle, one wins; armies reflect difference
  const s = inst.getState();
  const contestedTile = s.map.tiles[0][1];
  // Player A (5 army) vs Player B (3 army) attacking neutral (1 army)
  // Logic from `tick` should handle this. A has more initial army,
  // so A should win the contested neutral tile, then potentially B's tile.
  // In `tick`, operations are processed in player ID order (A then B).
  // A attacks [0,1]. B attacks [0,1]. The last operation processed wins.
  // Since tick processes operations in player ID order, A will move first.
  // A(5) vs Neutral(1) => A wins [0,1] with 4 army.
  // B(3) then attacks A's new tile [0,1] (army 4). B(3) vs A(4) => A wins.
  // So A should own [0,1] and [0,0], and B should own [0,2].
  expect(contestedTile.ownerId).toBe("A");
  expect(s.map.tiles[0][0].ownerId).toBe("A");
  expect(s.map.tiles[0][2].ownerId).toBe("B");
});

// 14. forceSnapshot queued during disconnect
it("14. forceSnapshot queued during disconnect", () => {
  connectorA.clearSent();
  connectorA.triggerDisconnect();
  inst.advance(); // Advance while disconnected, no sends to A
  expect(connectorA.sent.length).toBe(0);
  connectorA.triggerReconnect(); // Reconnect, should trigger snapshot
  expect(connectorA.sent.length).toBe(1);
  expect(connectorA.sent[0].type).toBe(SyncedStateServerStateUpdatePayloadType.SNAPSHOT); // Corrected type access
});

// 15. multi-field patch correctness
it("15. multi-field patch correctness", () => {
  // simulate both army and land change: A conquers B's tile
  connectorA.triggerClient({ type: "operations", payload: [{ optimisticId: 51, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 100 } }] });
  inst.advance();
  const last = connectorA.sent.at(-1)!;
  expect(last.type).toBe("patch"); // Corrected type access
  const paths = last.payload.payload.map(p => p.path.join("."));
  expect(paths).toContain("map.tiles.0.1.ownerId");
  expect(paths).toContain("players.A.land"); // Land count should change
  expect(paths).toContain("players.B.land"); // B's land count should decrease
  expect(paths).toContain("players.A.army");
  expect(paths).toContain("players.B.army");
});

// 16. immediate AFK defeat on updateGameState
it("16. immediate AFK defeat on updateGameState", () => {
  // fast-forward internal state (direct manipulation for test setup)
  const s = inst['state'];
  s.settings.afkThreshold = 1; // Make AFK threshold very low
  for (const p of Object.values(s.players)) p.lastActiveTick = s.tick - 2; // Make them AFK
  inst.advance();
  expect(inst.getState().players.A.status).toBe(PlayerStatus.Defeated); // Corrected enum access
  expect(inst.getState().players.B.status).toBe(PlayerStatus.Defeated); // Corrected enum access
});

// 17. no duplicate pendingOps on reconnect
it("17. no duplicate pendingOps on reconnect", () => {
  connectorA.clearSent();
  connectorA.triggerClient({ type: "operations", payload: [{ optimisticId: 61, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 } }] });
  inst.advance(); // op 61 processed
  connectorA.clearSent();
  connectorA.triggerDisconnect();
  connectorA.triggerReconnect();
  // Should send only snapshot, not replay op because op 61 was already confirmed.
  // If there were unconfirmed ops, they would be re-sent for replay.
  expect(connectorA.sent.length).toBe(1);
  expect(connectorA.sent[0].type).toBe(SyncedStateServerStateUpdatePayloadType.SNAPSHOT); // Corrected type access
  expect(connectorA.sent[0].payload.confirmedOp).toBe(61); // Confirmed op should be part of snapshot
});

// 18. send exceptions do not break instance
it("18. send exceptions do not break instance", () => {
  (connectorA as any).send = () => { throw new Error("fail"); };
  expect(() => inst.advance()).not.toThrow();
  expect(inst.getState().tick).toBeGreaterThan(0);
});

// 19. AFK defeat patch
it("19. AFK defeat patch", () => {
  const s = inst['state'];
  s.settings.afkThreshold = 1; // Make AFK threshold very low
  for (const p of Object.values(s.players)) p.lastActiveTick = s.tick - 2; // Make them AFK

  connectorA.clearSent();
  connectorB.clearSent();

  inst.advance();

  // Expect a patch for player status change
  expect(connectorA.sent.length).toBe(1);
  expect(connectorA.sent[0].type).toBe("patch");
  const aPatches = connectorA.sent[0].payload.payload as any[];
  expect(aPatches.some(p => p.path.includes("players.A.status") && p.value === PlayerStatus.Defeated)).toBe(true);
  expect(aPatches.some(p => p.path.includes("players.B.status") && p.value === PlayerStatus.Defeated)).toBe(true);

  expect(connectorB.sent.length).toBe(1);
  expect(connectorB.sent[0].type).toBe("patch");
  const bPatches = connectorB.sent[0].payload.payload as any[];
  expect(bPatches.some(p => p.path.includes("players.A.status") && p.value === PlayerStatus.Defeated)).toBe(true);
  expect(bPatches.some(p => p.path.includes("players.B.status") && p.value === PlayerStatus.Defeated)).toBe(true);
});

// 20. client sends no operations, lastActiveTick still updates from advance
it("20. client sends no operations, lastActiveTick still updates from advance", () => {
  const initialState = inst.getState();
  const playerAInitialLastActiveTick = initialState.players.A.lastActiveTick;

  // Advance without any client operations
  inst.advance();

  const stateAfterAdvance = inst.getState();
  // lastActiveTick should be updated to current tick if player is connected
  expect(stateAfterAdvance.players.A.lastActiveTick).toBe(stateAfterAdvance.tick);
  expect(stateAfterAdvance.players.B.lastActiveTick).toBe(stateAfterAdvance.tick);
  expect(stateAfterAdvance.players.A.lastActiveTick).toBeGreaterThan(playerAInitialLastActiveTick);
});

// 21. client sends operations, lastActiveTick updates from operation
it("21. client sends operations, lastActiveTick updates from operation", () => {
  const initialState = inst.getState();
  const playerAInitialLastActiveTick = initialState.players.A.lastActiveTick;

  // Simulate a client sending an operation
  connectorA.triggerClient({
    type: "operations",
    payload: [
      { optimisticId: 71, type: "MOVE", payload: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, percentage: 50 } }
    ]
  });

  inst.advance();

  const stateAfterAdvance = inst.getState();
  // lastActiveTick should be updated to current tick due to the operation
  expect(stateAfterAdvance.players.A.lastActiveTick).toBe(stateAfterAdvance.tick);
  // Player B did not send an operation, but is connected, so their lastActiveTick also updates
  expect(stateAfterAdvance.players.B.lastActiveTick).toBe(stateAfterAdvance.tick);
  expect(stateAfterAdvance.players.A.lastActiveTick).toBeGreaterThan(playerAInitialLastActiveTick);
});

// 22. player disconnects, lastActiveTick is not updated by advance
it("22. player disconnects, lastActiveTick is not updated by advance", () => {
  const initialState = inst.getState();
  const playerAInitialLastActiveTick = initialState.players.A.lastActiveTick;

  // Disconnect player A
  connectorA.triggerDisconnect();

  inst.advance();

  const stateAfterAdvance = inst.getState();
  // Player A's lastActiveTick should remain unchanged as they are disconnected
  expect(stateAfterAdvance.players.A.lastActiveTick).toBe(playerAInitialLastActiveTick);
  // Player B is still connected, so their lastActiveTick should update
  expect(stateAfterAdvance.players.B.lastActiveTick).toBe(stateAfterAdvance.tick);
});

// 23. player reconnects, lastActiveTick is updated again
it("23. player reconnects, lastActiveTick is updated again", () => {
  const initialState = inst.getState();
  const playerAInitialLastActiveTick = initialState.players.A.lastActiveTick;

  connectorA.triggerDisconnect();
  inst.advance(); // A's lastActiveTick remains at initial state
  expect(inst.getState().players.A.lastActiveTick).toBe(playerAInitialLastActiveTick);

  connectorA.triggerReconnect();
  inst.advance(); // A's lastActiveTick should now update

  const stateAfterReconnectAdvance = inst.getState();
  expect(stateAfterReconnectAdvance.players.A.lastActiveTick).toBe(stateAfterReconnectAdvance.tick);
  expect(stateAfterReconnectAdvance.players.A.lastActiveTick).toBeGreaterThan(playerAInitialLastActiveTick);
});

// 24. Player's status changes from Playing to Defeated and back to Playing due to reconnect
it("24. Player's status changes from Playing to Defeated and back to Playing due to reconnect", () => {
  const s = inst['state'];
  s.settings.afkThreshold = 1; // Very low AFK threshold

  // Advance to make player A AFK and Defeated
  inst.advance(); // tick = 1
  s.players.A.lastActiveTick = 0; // Simulate player A being inactive from tick 0
  inst.advance(); // tick = 2, player A becomes Defeated because afkThreshold is 1 and lastActiveTick is 0

  expect(inst.getState().players.A.status).toBe(PlayerStatus.Defeated);

  // Player A reconnects
  connectorA.triggerReconnect();
  inst.advance(); // Player A should now be Playing again, and lastActiveTick updated

  expect(inst.getState().players.A.status).toBe(PlayerStatus.Playing);
  expect(inst.getState().players.A.lastActiveTick).toBe(inst.getState().tick);
});

// 25. player status change from disconnected to playing after reconnect
it("25. player status change from disconnected to playing after reconnect", () => {
  connectorA.triggerDisconnect();
  inst.advance(); // A is disconnected, status remains Playing initially, but lastActiveTick stops updating
  expect(inst.getState().players.A.status).toBe(PlayerStatus.Playing); // Still Playing even if disconnected

  connectorA.triggerReconnect();
  inst.advance(); // A is now connected, lastActiveTick updates

  // Status should remain Playing, but confirm lastActiveTick updated
  expect(inst.getState().players.A.status).toBe(PlayerStatus.Playing);
  expect(inst.getState().players.A.lastActiveTick).toBe(inst.getState().tick);
});

// 26. Game ends (all players defeated), advance does not throw errors
it("26. Game ends (all players defeated), advance does not throw errors", () => {
  const s = inst['state'];
  s.players.A.status = PlayerStatus.Defeated;
  s.players.B.status = PlayerStatus.Defeated;

  expect(() => inst.advance()).not.toThrow();
  expect(inst.getState().tick).toBeGreaterThan(0); // Should still advance tick
});

// 27. Game ends (only one player left), advance does not throw errors
it("27. Game ends (only one player left), advance does not throw errors", () => {
  const s = inst['state'];
  s.players.B.status = PlayerStatus.Defeated; // B is defeated

  expect(() => inst.advance()).not.toThrow();
  expect(inst.getState().tick).toBeGreaterThan(0); // Should still advance tick
});