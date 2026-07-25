import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import {
  BombermanPreGameServerEventType,
  SyncedStateServerEventType,
  SyncedStateServerStateUpdatePayloadType,
  type BombermanRoomState,
  type BombermanPreGameServerEvent,
  type SyncedStateServerEvent,
} from "@generale/types";
import { useVersionedOptimisticState } from "../useVersionedOptimisticState";

const SNAPSHOT = SyncedStateServerStateUpdatePayloadType.SNAPSHOT;
const PATCH = SyncedStateServerStateUpdatePayloadType.PATCH;
const CUSTOM = SyncedStateServerEventType.CUSTOM;
const STATE_UPDATE = SyncedStateServerEventType.STATE_UPDATE;

// ─── Helpers ───

function makeRoomState(overrides: Partial<BombermanRoomState> = {}): BombermanRoomState {
  return {
    roomName: "Test Room",
    phase: "lobby",
    maxPlayers: 4,
    hostId: "host-1",
    config: {
      playerLimit: 4,
      mapWidth: 11,
      mapHeight: 11,
      tickRate: 10,
      bombFuse: 3,
      bombLimit: 1,
      blastRadius: 1,
      roundTimeSec: 180,
      shrinkEnabled: true,
      itemDropRate: 0.3,
      items: ["BOMB_UP", "FIRE_UP", "SPEED_UP"],
      mode: "multi",
    },
    players: [
      { id: "host-1", name: "Alice", ready: false, isHost: true },
      { id: "player-2", name: "Bob", ready: false, isHost: false },
    ],
    ...overrides,
  };
}

function serverSnapshot(state: BombermanRoomState, version: number, confirmedOp: number): SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent> {
  return {
    type: STATE_UPDATE,
    payload: { type: SNAPSHOT, version, confirmedOp, payload: state },
  } as SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent>;
}

function serverPatch(patches: { op: string; path: string; value: unknown }[], version: number, confirmedOp: number): SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent> {
  return {
    type: STATE_UPDATE,
    payload: { type: PATCH, version, confirmedOp, payload: patches },
  } as SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent>;
}

function serverCustom(event: BombermanPreGameServerEvent): SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent> {
  return {
    type: CUSTOM,
    payload: event,
  } as SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent>;
}

// ─── Harness ───

function RoomHarness(props: { init: BombermanRoomState }) {
  const state = useVersionedOptimisticState(props.init, 0, (s) => s);
  return (
    <div>
      <div data-testid="state">{JSON.stringify(state.mergedState())}</div>
      <div data-testid="version">{state.version()}</div>
      <div data-testid="pending">{JSON.stringify(state.getPendingEvents())}</div>
      <button data-testid="ready" onClick={() => state.dispatchOptimisticEvent({ type: "READY" } as any)} />
      <button data-testid="start" onClick={() => state.dispatchOptimisticEvent({ type: "START_GAME" } as any)} />
      <button
        data-testid="apply-snapshot"
        onClick={() => state.reconcileFromServer(serverSnapshot(makeRoomState(), 1, 0).payload)}
      />
      <button
        data-testid="apply-ready-patch"
        onClick={() =>
          state.reconcileFromServer(
            serverPatch([{ op: "replace", path: "/players/0/ready", value: true }], 2, 1).payload,
          )
        }
      />
      <button
        data-testid="apply-bob-ready-patch"
        onClick={() =>
          state.reconcileFromServer(
            serverPatch([{ op: "replace", path: "/players/1/ready", value: true }], 3, 2).payload,
          )
        }
      />
    </div>
  );
}

// ─── Tests ───

describe("Bomberman sync protocol contract", () => {
  // ─── Section A: Enum contract (would have caught the "STATE_UPDATE" vs "state-update" bug) ───

  describe("event type enum values", () => {
    it("uses the round and match lifecycle event wire values", () => {
      expect(BombermanPreGameServerEventType.KICKED).toBe("kicked");
      expect(BombermanPreGameServerEventType.ROUND_STARTED).toBe("roundstarted");
      expect(BombermanPreGameServerEventType.ROUND_ENDED).toBe("roundended");
      expect(BombermanPreGameServerEventType.MATCH_ENDED).toBe("matchended");
      expect(BombermanPreGameServerEventType.ROOM_DISBANDED).toBe("disbanded");
      expect(SyncedStateServerEventType.CUSTOM).toBe("custom");
      expect(SyncedStateServerEventType.STATE_UPDATE).toBe("state-update");
    });

    it("server snapshot message has correct wire format", () => {
      const msg = serverSnapshot(makeRoomState(), 1, 0);
      expect(msg.type).toBe("state-update");
      expect(msg.payload.type).toBe("snapshot");
      expect(msg.payload.version).toBe(1);
    });

    it("server patch message has correct wire format", () => {
      const msg = serverPatch([{ op: "replace", path: "/players/0/ready", value: true }], 2, 1);
      expect(msg.type).toBe("state-update");
      expect(msg.payload.type).toBe("patch");
    });

    it("server custom event wraps ROUND_STARTED correctly", () => {
      const msg = serverCustom({
        type: BombermanPreGameServerEventType.ROUND_STARTED,
        startedAt: 1000,
        match: {
          format: "single",
          targetWins: 1,
          currentRound: 1,
          currentAttempt: 1,
          scores: [],
          roundResults: [],
          winner: null,
          nextRoundStartsAt: null,
        },
      });
      expect(msg.type).toBe("custom");
      expect(msg.payload.type).toBe("roundstarted");
    });

    it("server custom event wraps KICKED correctly", () => {
      const msg = serverCustom({ type: BombermanPreGameServerEventType.KICKED, reason: "test" });
      expect(msg.type).toBe("custom");
      expect(msg.payload.type).toBe("kicked");
      expect((msg.payload as { reason: string }).reason).toBe("test");
    });
  });

  // ─── Section B: Client processing ───

  describe("client reconcileFromServer", () => {
    it("applies server snapshot and updates merged state", () => {
      render(() => <RoomHarness init={makeRoomState({ players: [] })} />);
      fireEvent.click(screen.getByTestId("apply-snapshot"));
      const state = JSON.parse(screen.getByTestId("state").textContent!) as BombermanRoomState;
      expect(state.roomName).toBe("Test Room");
      expect(state.players.length).toBe(2);
      expect(state.players[0]!.name).toBe("Alice");
      expect(state.players[1]!.name).toBe("Bob");
      expect(screen.getByTestId("version").textContent).toBe("1");
    });

    it("applies patch to modify player ready state", () => {
      render(() => <RoomHarness init={makeRoomState()} />);
      fireEvent.click(screen.getByTestId("apply-snapshot"));
      fireEvent.click(screen.getByTestId("apply-ready-patch"));
      const state = JSON.parse(screen.getByTestId("state").textContent!) as BombermanRoomState;
      expect(state.players[0]!.ready).toBe(true);
      expect(state.players[1]!.ready).toBe(false);
      expect(screen.getByTestId("version").textContent).toBe("2");
    });

    it("confirmedOp clears pending optimistic events on client", () => {
      render(() => <RoomHarness init={makeRoomState()} />);
      fireEvent.click(screen.getByTestId("apply-snapshot"));
      // Client sends READY → queued as pending
      fireEvent.click(screen.getByTestId("ready"));
      expect(JSON.parse(screen.getByTestId("pending").textContent!).length).toBe(1);
      // Server confirms with patch (confirmedOp=1 covers the READY event)
      fireEvent.click(screen.getByTestId("apply-ready-patch"));
      expect(JSON.parse(screen.getByTestId("pending").textContent!).length).toBe(0);
      // State updated correctly
      const state = JSON.parse(screen.getByTestId("state").textContent!) as BombermanRoomState;
      expect(state.players[0]!.ready).toBe(true);
    });

    it("unconfirmed events survive snapshot that doesn't cover them", () => {
      render(() => <RoomHarness init={makeRoomState()} />);
      fireEvent.click(screen.getByTestId("apply-snapshot"));
      fireEvent.click(screen.getByTestId("ready"));
      fireEvent.click(screen.getByTestId("start"));
      // Snapshot with confirmedOp=0 — no events confirmed, all survive
      fireEvent.click(screen.getByTestId("apply-snapshot"));
      expect(JSON.parse(screen.getByTestId("pending").textContent!).length).toBe(2);
    });
  });

  // ─── Section C: Full lifecycle ───

  describe("full room lifecycle", () => {
    it("create → join → both ready → start", () => {
      const aliceRoom = makeRoomState({ players: [{ id: "alice", name: "Alice", ready: false, isHost: true }] });
      render(() => <RoomHarness init={aliceRoom} />);

      // Server snapshot: Bob joined
      fireEvent.click(screen.getByTestId("apply-snapshot"));
      let state = JSON.parse(screen.getByTestId("state").textContent!) as BombermanRoomState;
      expect(state.players.length).toBe(2);

      // Alice clicks Ready → queued locally, not applied (server-driven state)
      fireEvent.click(screen.getByTestId("ready"));
      state = JSON.parse(screen.getByTestId("state").textContent!) as BombermanRoomState;
      expect(state.players[0]!.ready).toBe(false); // NOT applied locally — correct for room protocol
      expect(JSON.parse(screen.getByTestId("pending").textContent!).length).toBe(1);

      // Server confirms Alice ready
      fireEvent.click(screen.getByTestId("apply-ready-patch"));
      state = JSON.parse(screen.getByTestId("state").textContent!) as BombermanRoomState;
      expect(state.players[0]!.ready).toBe(true);

      // Server confirms Bob ready too
      fireEvent.click(screen.getByTestId("apply-bob-ready-patch"));
      state = JSON.parse(screen.getByTestId("state").textContent!) as BombermanRoomState;
      expect(state.players[0]!.ready).toBe(true);
      expect(state.players[1]!.ready).toBe(true);
    });
  });
});
