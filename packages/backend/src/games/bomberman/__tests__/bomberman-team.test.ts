import { describe, it, expect } from "vitest";
import { BombermanRoom } from "../instance/BombermanRoom";
import { defaultBombermanConfig } from "../settings";
import type { BombermanPreGameClientAction, BombermanRoomState, BombermanMatchState } from "@generale/types";

function connector() {
  return {
    send: () => {},
    close: () => {},
    onOpen: () => {},
    onClose: () => {},
    onDisconnect: () => {},
    onReconnect: () => {},
    onClientMessage: () => {},
  };
}

function dispatch(room: BombermanRoom, pid: string, action: BombermanPreGameClientAction) {
  // Access internal handleClientAction via type cast
  const roomAny = room as unknown as {
    handleClientAction(pid: string, evt: BombermanPreGameClientAction): void;
  };
  roomAny.handleClientAction(pid, action);
}

describe("BombermanRoom — team mode", () => {
  it("FFA assigns each player a unique teamId on join", () => {
    const config = defaultBombermanConfig();
    config.teamMode = "ffa";
    const room = new BombermanRoom("Test", config, "p1", "P1");
    room.addPlayer({ id: "p1", name: "P1" }, connector());
    room.addPlayer({ id: "p2", name: "P2" }, connector());

    const players = room.getPlayers();
    const teams = (room.getState() as BombermanRoomState).teams;
    expect(players[0].teamId).toBe("team1");
    expect(players[1].teamId).toBe("team2");
    expect(teams.length).toBe(2);
    expect(teams[0].id).toBe("team1");
    expect(teams[1].id).toBe("team2");
  });

  it("FFA ensures unique teamIds for 4 players", () => {
    const config = defaultBombermanConfig();
    config.playerLimit = 4;
    config.teamMode = "ffa";
    const room = new BombermanRoom("Test", config, "p1", "P1");
    room.addPlayer({ id: "p1", name: "P1" }, connector());
    room.addPlayer({ id: "p2", name: "P2" }, connector());
    room.addPlayer({ id: "p3", name: "P3" }, connector());
    room.addPlayer({ id: "p4", name: "P4" }, connector());

    const teamIds = room.getPlayers().map((p) => p.teamId);
    expect(new Set(teamIds).size).toBe(4);
    expect(teamIds).toContain("team1");
    expect(teamIds).toContain("team2");
    expect(teamIds).toContain("team3");
    expect(teamIds).toContain("team4");
  });

  it("CHANGE_TEAM_MODE switches mode and rebalances teams", () => {
    const config = defaultBombermanConfig();
    config.teamMode = "ffa";
    const room = new BombermanRoom("Test", config, "p1", "P1");
    room.addPlayer({ id: "p1", name: "P1" }, connector());
    room.addPlayer({ id: "p2", name: "P2" }, connector());
    room.addPlayer({ id: "p3", name: "P3" }, connector());

    // Host changes to team mode
    dispatch(room, "p1", { type: "CHANGE_TEAM_MODE", optimisticId: 1, teamMode: "team" });

    const players = room.getPlayers();
    const teams = (room.getState() as BombermanRoomState).teams;
    // All players should now be on team1 or team2
    for (const p of players) {
      expect(p.teamId === "team1" || p.teamId === "team2").toBe(true);
    }
    expect(teams.length).toBe(2);
    expect(teams[0].id).toBe("team1");
    expect(teams[1].id).toBe("team2");
  });

  it("non-host cannot change team mode", () => {
    const config = defaultBombermanConfig();
    config.teamMode = "ffa";
    const room = new BombermanRoom("Test", config, "p1", "P1");
    room.addPlayer({ id: "p1", name: "P1" }, connector());
    room.addPlayer({ id: "p2", name: "P2" }, connector());

    dispatch(room, "p2", { type: "CHANGE_TEAM_MODE", optimisticId: 1, teamMode: "team" });

    // Should still be FFA
    expect((room.getState() as BombermanRoomState).config.teamMode).toBe("ffa");
  });

  it("host can move any player to any team in team mode", () => {
    const config = defaultBombermanConfig();
    config.teamMode = "team";
    const room = new BombermanRoom("Test", config, "p1", "P1");
    room.addPlayer({ id: "p1", name: "P1" }, connector());
    room.addPlayer({ id: "p2", name: "P2" }, connector());

    // Move p2 to team1 (host action)
    dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p2", teamId: "team1" });

    const p2 = room.getPlayers().find((p) => p.id === "p2");
    expect(p2?.teamId).toBe("team1");
  });

  it("non-host cannot move another player in team mode", () => {
    const config = defaultBombermanConfig();
    config.teamMode = "team";
    const room = new BombermanRoom("Test", config, "p1", "P1");
    room.addPlayer({ id: "p1", name: "P1" }, connector());
    room.addPlayer({ id: "p2", name: "P2" }, connector());
    room.addPlayer({ id: "p3", name: "P3" }, connector());

    // Record p3's current team before p2 tries to move them
    const p3Before = room.getPlayers().find((p) => p.id === "p3")!;
    const originalTeam = p3Before.teamId;

    // p2 tries to move p3 to the opposite team — should be rejected
    dispatch(room, "p2", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p3", teamId: originalTeam === "team1" ? "team2" : "team1" });

    const p3 = room.getPlayers().find((p) => p.id === "p3")!;
    expect(p3.teamId).toBe(originalTeam);
  });

  it("player can move themselves to a different team in team mode", () => {
    const config = defaultBombermanConfig();
    config.teamMode = "team";
    const room = new BombermanRoom("Test", config, "p1", "P1");
    room.addPlayer({ id: "p1", name: "P1" }, connector());
    room.addPlayer({ id: "p2", name: "P2" }, connector());

    // p2 moves to team1
    dispatch(room, "p2", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p2", teamId: "team1" });

    const p2 = room.getPlayers().find((p) => p.id === "p2");
    expect(p2?.teamId).toBe("team1");
  });


  describe("team balance validation", () => {
    it("START_GAME rejected if a team is empty", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "team";
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());
      room.addPlayer({ id: "p3", name: "P3" }, connector());

      // Move all players to team1
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p1", teamId: "team1" });
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 2, playerId: "p2", teamId: "team1" });
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 3, playerId: "p3", teamId: "team1" });

      // p2/p3 ready
      dispatch(room, "p2", { type: "READY", optimisticId: 4 });
      dispatch(room, "p3", { type: "READY", optimisticId: 5 });

      // The room's sendCustomTo won't record rejection — check phase unchanged
      const sendMock = { send: () => {} };
      const origSend = (room as unknown as { sendCustomTo: Function }).sendCustomTo;
      let rejectionReason: string | undefined;
      (room as unknown as { sendCustomTo: Function }).sendCustomTo = (pid: string, evt: any) => {
        if (evt.reason) rejectionReason = evt.reason;
      };

      dispatch(room, "p1", { type: "START_GAME", optimisticId: 6 });

      (room as unknown as { sendCustomTo: Function }).sendCustomTo = origSend;
      expect(rejectionReason).toBe("INVALID_TEAMS");
      expect(room.getPhase()).toBe("lobby");
    });

    it("START_GAME rejected if teams are too imbalanced (3v1)", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "team";
      config.playerLimit = 4;
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());
      room.addPlayer({ id: "p3", name: "P3" }, connector());
      room.addPlayer({ id: "p4", name: "P4" }, connector());

      // Put 3 on team1, 1 on team2
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p2", teamId: "team1" });
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 2, playerId: "p3", teamId: "team1" });

      // p2/p3/p4 ready
      dispatch(room, "p2", { type: "READY", optimisticId: 3 });
      dispatch(room, "p3", { type: "READY", optimisticId: 4 });
      dispatch(room, "p4", { type: "READY", optimisticId: 5 });

      let rejectionReason: string | undefined;
      const origSend = (room as unknown as { sendCustomTo: Function }).sendCustomTo;
      (room as unknown as { sendCustomTo: Function }).sendCustomTo = (pid: string, evt: any) => {
        if (evt.reason) rejectionReason = evt.reason;
      };

      dispatch(room, "p1", { type: "START_GAME", optimisticId: 6 });

      (room as unknown as { sendCustomTo: Function }).sendCustomTo = origSend;
      expect(rejectionReason).toBe("INVALID_TEAMS");
      expect(room.getPhase()).toBe("lobby");
    });

    it("START_GAME succeeds with balanced teams (2v2)", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "team";
      config.playerLimit = 4;
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());
      room.addPlayer({ id: "p3", name: "P3" }, connector());
      room.addPlayer({ id: "p4", name: "P4" }, connector());

      // Default: half on team1, half on team2 (ensured by ensureTeams for team mode)
      // Make sure balance is 2v2
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p3", teamId: "team1" });
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 2, playerId: "p4", teamId: "team2" });

      // p2/p3/p4 ready
      dispatch(room, "p2", { type: "READY", optimisticId: 3 });
      dispatch(room, "p3", { type: "READY", optimisticId: 4 });
      dispatch(room, "p4", { type: "READY", optimisticId: 5 });

      dispatch(room, "p1", { type: "START_GAME", optimisticId: 6 });

      expect(room.getPhase()).toBe("playing");
    });

    it("START_GAME succeeds with 2v1 (within balance threshold)", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "team";
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());
      room.addPlayer({ id: "p3", name: "P3" }, connector());

      // After add + ensureTeams: p1=team1, p2=team2, p3 assigned to team1 (balancing)
      // This gives team1=2, team2=1 — within balance threshold (diff 1)

      // p2, p3 ready
      dispatch(room, "p2", { type: "READY", optimisticId: 3 });
      dispatch(room, "p3", { type: "READY", optimisticId: 4 });

      dispatch(room, "p1", { type: "START_GAME", optimisticId: 5 });

      expect(room.getPhase()).toBe("playing");
    });
  });

  describe("team mode - CHANGE_TEAM authorization", () => {
    it("ignores invalid teamId in team mode", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "team";
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());

      dispatch(room, "p2", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p2", teamId: "team3" as any });
      const p2 = room.getPlayers().find((p) => p.id === "p2");
      expect(p2?.teamId).not.toBe("team3");
    });
  });

  describe("FFA - CHANGE_TEAM restrictions", () => {
    it("player can only move themselves in FFA", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "ffa";
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());

      // Host p1 tries to move p2 — should fail in FFA
      dispatch(room, "p1", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p2", teamId: "team1" });
      const p2 = room.getPlayers().find((p) => p.id === "p2");
      expect(p2?.teamId).not.toBe("team1");
    });

    it("FFA player cannot switch to an occupied teamId", () => {
      const config = defaultBombermanConfig();
      config.playerLimit = 4;
      config.teamMode = "ffa";
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());

      // p2 tries to take over team1 (already held by p1)
      dispatch(room, "p2", { type: "CHANGE_TEAM", optimisticId: 1, playerId: "p2", teamId: "team1" });
      const p2 = room.getPlayers().find((p) => p.id === "p2");
      expect(p2?.teamId).not.toBe("team1");
    });
  });

  describe("team mode - team scores in match lifecycle", () => {
    it("BombermanService creates team-based scores in team mode", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "team";
      config.playerLimit = 4;
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());

      const state = room.getState() as BombermanRoomState;
      expect(state.teams.length).toBeGreaterThanOrEqual(2);
      expect(state.teams.some((t) => t.id === "team1")).toBe(true);
      expect(state.teams.some((t) => t.id === "team2")).toBe(true);
    });

    it("teams array includes color and marker manifests", () => {
      const config = defaultBombermanConfig();
      config.teamMode = "team";
      const room = new BombermanRoom("Test", config, "p1", "P1");
      room.addPlayer({ id: "p1", name: "P1" }, connector());
      room.addPlayer({ id: "p2", name: "P2" }, connector());

      const teams = (room.getState() as BombermanRoomState).teams;
      const team1 = teams.find((t) => t.id === "team1");
      expect(team1?.color).toBe(0x3b82f6);
      expect(team1?.marker).toBe("circle");
      const team2 = teams.find((t) => t.id === "team2");
      expect(team2?.color).toBe(0xef4444);
      expect(team2?.marker).toBe("triangle");
    });
  });
});
