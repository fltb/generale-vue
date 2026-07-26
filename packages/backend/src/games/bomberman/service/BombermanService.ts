import type {
  BombermanConfig,
  BombermanDirection,
  BombermanGameEndResult,
  BombermanMapDefinition,
  BombermanMapRef,
  BombermanMapValidationIssue,
  BombermanMatchRanking,
  BombermanMatchState,
  BombermanOperation,
  BombermanPreGameClientAction,
  BombermanPreGameServerEvent,
  BombermanReplayFrame,
  BombermanReplayHeader,
  BombermanReplayParticipant,
  BombermanReplayRound,
  BombermanRoomState,
  BombermanState,
  BombermanWinner,
  ChatClientToServer,
  ChatSenderMeta,
  ChatServerToClient,
  GameId,
  PlayerId,
  ServerSyncConnector,
  SyncedStateServerEvent,
  TeamId,
} from "@generale/types";
import {
  BOMBERMAN_PRESET_DEFINITIONS,
  BOMBERMAN_REPLAY_ENGINE_VERSION,
  BOMBERMAN_THEME_MANIFEST,
  BombermanPreGameServerEventType,
  PreGamePlayerStatus,
  SyncedStateServerEventType,
  createBombermanMatchState,
} from "@generale/types";
import { Mulberry32, generateBombermanMap, validateBombermanMapDefinition } from "@generale/bomberman-engine";
import type { BombermanGameOptions } from "@generale/bomberman-engine";
import { registerDomainHandler, unregisterDomainHandler } from "../../../plugins/websocket";
import { GameChatInstance } from "../../../game/instance/GameChatInstance";
import { GameSyncManager } from "../../../game/instance/sync-manager";
import type { SyncConnector } from "../../../game/instance/sync-manager";
import { mapService } from "../../../services/mapService";
import { bombermanReplayService } from "../../../services/bombermanReplayService";
import { decideBombermanBotOperation } from "../bot/decideBombermanBotOperation";
import type { BombermanBotContext } from "../bot/decideBombermanBotOperation";
import { BombermanGame } from "../instance/BombermanGame";
import { BombermanRoom } from "../instance/BombermanRoom";

function isBombermanDirection(value: unknown): value is BombermanDirection {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

export function decodeBombermanOperation(value: unknown): BombermanOperation | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;
  const type = event["type"];
  if (typeof type !== "string") return null;
  if ("optimisticId" in event && typeof event["optimisticId"] !== "number") return null;
  const optimisticId = typeof event["optimisticId"] === "number" ? event["optimisticId"] : undefined;
  const withId = <T extends BombermanOperation>(operation: T): T =>
    (optimisticId === undefined ? operation : { ...operation, optimisticId }) as T;

  switch (type) {
    case "SET_DIRECTION":
      if (event["direction"] !== null && event["direction"] !== undefined && !isBombermanDirection(event["direction"]))
        return null;
      return withId({
        type: "SET_DIRECTION",
        direction: (event["direction"] as BombermanDirection | null | undefined) ?? null,
      });
    case "MOVE":
      return isBombermanDirection(event["direction"]) ? withId({ type: "MOVE", direction: event["direction"] }) : null;
    case "PLACE_BOMB":
      return withId({ type: "PLACE_BOMB" });
    case "ACTION":
      return withId({ type: "ACTION" });
    case "DETONATE":
      return withId({ type: "DETONATE" });
    case "SURRENDER":
      return withId({ type: "SURRENDER" });
    case "NOOP":
      return withId({ type: "NOOP" });
    default:
      return null;
  }
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

type MapResolution =
  | { ok: true; maps: BombermanMapDefinition[] }
  | { ok: false; reason: "MAP_NOT_FOUND" | "MAP_INVALID"; issues?: BombermanMapValidationIssue[] };
type SingleMapResolution =
  | { ok: true; map: BombermanMapDefinition }
  | { ok: false; reason: "MAP_NOT_FOUND" | "MAP_INVALID"; issues?: BombermanMapValidationIssue[] };

export class BombermanService {
  public gameId: GameId;
  public roomName: string;
  private room: BombermanRoom;
  private game: BombermanGame | null = null;
  private destroyed = false;
  private chat: GameChatInstance;
  private sync = this.createSyncManager();
  private disconnectTimers = new Map<PlayerId, ReturnType<typeof setTimeout>>();
  private roundStartTimer: ReturnType<typeof setTimeout> | undefined;
  private replayId: string | null = null;
  private roundRecording: {
    roundNumber: number;
    attempt: number;
    seed: number;
    initialState: BombermanState;
    frames: BombermanReplayFrame[];
  } | null = null;
  private gamePlayerIds = new Set<PlayerId>();

  public onDisband?: () => void;
  public onLobbyUpdate?: () => void;
  private roomUpdateEmitter?: (gameId: string) => void;

  constructor(
    gameId: GameId,
    roomName: string,
    config: BombermanConfig,
    creatorId: string,
    creatorName: string,
    password?: string,
  ) {
    this.gameId = gameId;
    this.roomName = roomName;
    this.chat = new GameChatInstance({ allowedQuickMessageKeys: ["help", "danger", "nice", "follow_me"] });
    this.room = new BombermanRoom(roomName, config, creatorId, creatorName, password);
    this.chat.activeStageInstance = this.createChatRoster();
    this.room.onGameStart((playerIds, startedAt) => {
      void this.startGame(playerIds, startedAt);
    });
    this.room.onDisbanded(() => this.onDisband?.());
    this.room.onSpectatorChange(() => {
      this.onLobbyUpdate?.();
      this.roomUpdateEmitter?.(this.gameId);
    });
    this.room.onStateChange(() => {
      this.onLobbyUpdate?.();
      this.roomUpdateEmitter?.(this.gameId);
    });
  }

  private createSyncManager(): GameSyncManager<BombermanState> {
    return new GameSyncManager<BombermanState>({
      send: {
        sendSnapshot: (connector, state, version, confirmedOp) =>
          connector.send({
            type: SyncedStateServerEventType.STATE_UPDATE,
            payload: { type: "snapshot", version, confirmedOp, payload: state },
          }),
        sendPatch: (connector, patches, version, confirmedOp) =>
          connector.send({
            type: SyncedStateServerEventType.STATE_UPDATE,
            payload: { type: "patch", version, confirmedOp, payload: patches },
          }),
      },
      customEventType: "CUSTOM",
      displacedPayloadType: "DISPLACED",
    });
  }

  private getRole(connector: { context: unknown }): "player" | "spectator" {
    const context = connector.context as { role?: unknown };
    return context.role === "spectator" ? "spectator" : "player";
  }

  private createChatRoster() {
    return {
      canJoin: (playerId: PlayerId) => {
        if (this.destroyed || this.room.isDisbanded()) return { success: false as const, message: "Room disbanded" };
        return this.room.getPlayers().some((player) => player.id === playerId) ||
          this.room.getSpectators().some((spectator) => spectator.id === playerId)
          ? { success: true as const }
          : { success: false as const, message: "Player is not in this room" };
      },
      getPlayerChatMeta: (playerId: PlayerId): ChatSenderMeta | null => {
        const player = this.room.getPlayers().find((candidate) => candidate.id === playerId);
        if (player) {
          const team = this.room.getState().teams.find((candidate) => candidate.id === player.teamId);
          return {
            teamId: player.teamId,
            teamName: team?.name ?? player.teamId,
            teamMode: this.room.getConfig().teamMode,
            presence: this.gamePlayerIds.has(playerId) ? "game" : "room",
            status: this.gamePlayerIds.has(playerId) ? PreGamePlayerStatus.Playing : PreGamePlayerStatus.Lobby,
          };
        }
        if (this.room.getSpectators().some((spectator) => spectator.id === playerId)) {
          return { presence: "spectator", status: PreGamePlayerStatus.Lobby };
        }
        return null;
      },
      getPlayersForTeamChat: () =>
        this.room.getPlayers().map((player) => ({
          id: player.id,
          teamId: player.teamId,
          status: this.gamePlayerIds.has(player.id) ? "playing" : "lobby",
        })),
    };
  }

  registerHandlers(): void {
    registerDomainHandler<
      BombermanPreGameClientAction,
      SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent>
    >(`room-${this.gameId}`, (connector) => {
      const { userid, username, password } = connector.context;
      if (!(userid && username)) {
        connector.close(4001, "Missing auth");
        return;
      }
      if (this.room.isDisbanded()) {
        connector.close(4004, "Room disbanded");
        return;
      }
      const user = { id: userid, name: username, ...(password ? { password } : {}) };
      const result =
        this.getRole(connector) === "spectator"
          ? this.room.addSpectator(user, connector as never)
          : this.room.addPlayer(user, connector as never);
      if (!result.success) connector.close(4003, result.message);
    });

    registerDomainHandler<Record<string, unknown>, Record<string, unknown>>(`game-${this.gameId}`, (connector) => {
      const { userid } = connector.context;
      if (!userid) {
        connector.close(4001, "Missing auth");
        return;
      }
      const game = this.game;
      if (!game) {
        connector.close(4002, "Game not started");
        return;
      }
      const role = this.getRole(connector);
      if (role === "spectator") {
        this.sync.addSpectator(userid, connector as unknown as SyncConnector);
        this.sync.sendToSpectator(userid, game.getState(), game.getState().tick, true);
        return;
      }
      if (!this.gamePlayerIds.has(userid)) {
        connector.close(4003, "Player is not participating in this round");
        return;
      }
      this.sync.addPlayer(userid, connector as unknown as SyncConnector);
      const pending = this.disconnectTimers.get(userid);
      if (pending) {
        clearTimeout(pending);
        this.disconnectTimers.delete(userid);
      }
      connector.onClientMessage((event) => {
        const operation = decodeBombermanOperation(event);
        if (operation) game.handleAction(userid, operation);
      });
      connector.onClose(() => {
        game.stopMovement(userid);
        const timer = setTimeout(() => {
          if (this.game === game && !this.sync.getPlayerConnector(userid))
            game.handleAction(userid, { type: "SURRENDER" });
        }, 30_000);
        this.disconnectTimers.set(userid, timer);
      });
      this.sync.sendToPlayer(userid, game.getState(), game.getState().tick, 0, true);
    });

    registerDomainHandler(`chat-${this.gameId}`, (connector) => {
      const { userid, username } = connector.context;
      if (!(userid && username)) {
        connector.close(4001, "Missing auth");
        return;
      }
      const result = this.chat.addPlayer(
        { id: userid, name: username },
        connector as unknown as ServerSyncConnector<ChatClientToServer, ChatServerToClient>,
      );
      if (!result.success) connector.close(4003, result.message);
    });
  }

  async startGame(playerIds?: PlayerId[], startedAt?: number): Promise<void> {
    if (this.destroyed) return;
    if (this.game) return;
    const config = this.room.getConfig();
    const state = this.room.getState();
    const participants =
      playerIds ??
      this.room
        .getPlayers()
        .filter((player) => player.status !== "spectating")
        .map((player) => player.id);
    if (participants.length === 0) {
      this.rejectStart("INVALID_PLAYER_COUNT");
      return;
    }

    if (state.match.winner) {
      state.match = createBombermanMatchState(config.matchFormat);
      delete state.frozenMaps;
      this.replayId = null;
    }

    const roomPlayers = this.room.getPlayers().filter((player) => participants.includes(player.id));
    const gamePlayers: BombermanGameOptions["players"] = roomPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      teamId: player.teamId,
      isBot: false,
      skinId: player.skinId ?? "classic-blue",
    }));
    const humanTeamCounts = new Map<TeamId, number>();
    for (const player of gamePlayers) humanTeamCounts.set(player.teamId, (humanTeamCounts.get(player.teamId) ?? 0) + 1);
    for (let index = 0; index < config.botCount; index += 1) {
      const botId = `bot-${index + 1}`;
      let teamId: TeamId;
      if (config.teamMode === "team") {
        const team1 = humanTeamCounts.get("team1") ?? 0;
        const team2 = humanTeamCounts.get("team2") ?? 0;
        teamId = team1 <= team2 ? "team1" : "team2";
      } else {
        teamId = `team${gamePlayers.length + 1}` as TeamId;
      }
      humanTeamCounts.set(teamId, (humanTeamCounts.get(teamId) ?? 0) + 1);
      gamePlayers.push({ id: botId, name: `Bot ${index + 1}`, teamId, isBot: true, skinId: "classic-red" });
    }

    const match = state.match;
    if (match.scores.length === 0) {
      if (config.teamMode === "team") {
        const teamIds = new Set<TeamId>();
        for (const player of gamePlayers) teamIds.add(player.teamId);
        match.scores = [...teamIds].map((id) => ({ competitor: { kind: "team", id }, wins: 0 }));
      } else {
        match.scores = gamePlayers.map((player) => ({
          competitor: { kind: "player", id: player.id },
          wins: 0,
        }));
      }
    }

    let maps: BombermanMapDefinition[];
    if (state.frozenMaps && state.frozenMaps.length > 0) {
      maps = state.frozenMaps;
    } else {
      const resolved = await this.resolveMatchMaps(config);
      if (!resolved.ok) {
        this.rejectStart(resolved.reason, resolved.issues);
        return;
      }
      maps = resolved.maps;
      state.frozenMaps = maps.map((map) => structuredClone(map));
    }

    this.sync = this.createSyncManager();
    const roundSeed = fnv1a(`${this.gameId}:${match.currentRound}:${match.currentAttempt}`);
    const mapIndex = (match.currentRound - 1) % maps.length;
    const map = maps[mapIndex];
    if (!map) {
      this.rejectStart("MAP_INVALID");
      return;
    }
    const game = new BombermanGame({
      config,
      seed: roundSeed,
      map: structuredClone(map),
      players: gamePlayers,
    });
    this.game = game;
    this.gamePlayerIds = new Set(gamePlayers.filter((player) => !player.isBot).map((player) => player.id));
    this.chat.activeStageInstance = this.createChatRoster();

    if (!this.replayId) {
      const replayParticipants: BombermanReplayParticipant[] = gamePlayers.map((player) => ({
        playerId: player.id,
        name: player.name,
        teamId: player.teamId,
        skinId: player.skinId,
        isBot: player.isBot,
      }));
      const header: BombermanReplayHeader = {
        schemaVersion: 1,
        engineVersion: BOMBERMAN_REPLAY_ENGINE_VERSION,
        // Unique per match: the room's gameId is stable across rematches, and
        // bomberman_replays.match_id has a UNIQUE constraint.
        matchId: `${this.gameId}:${crypto.randomUUID()}`,
        config,
        participants: replayParticipants,
      };
      try {
        this.replayId = bombermanReplayService.startRecording(
          header,
          gamePlayers.filter((player) => !player.isBot).map((player) => player.id),
        );
      } catch (error) {
        // Recording is best-effort: a replay DB failure must never block or
        // crash a match start. All downstream uses null-check replayId.
        console.error(`[Bomberman] replay recording unavailable for ${this.gameId}:`, error);
        this.replayId = null;
      }
    }
    this.roundRecording = {
      roundNumber: match.currentRound,
      attempt: match.currentAttempt,
      seed: roundSeed,
      initialState: structuredClone(game.getState()),
      frames: [],
    };

    const botContexts = new Map<PlayerId, BombermanBotContext>();
    for (const player of gamePlayers) {
      if (player.isBot) {
        botContexts.set(player.id, {
          playerId: player.id,
          difficulty: config.botDifficulty,
          decisionTick: 0,
          randomState: fnv1a(`${roundSeed}:${player.id}`),
        });
      }
    }
    game.onBeforeTick(() => {
      const currentState = game.getState();
      for (const [botId, context] of botContexts) {
        const decision = decideBombermanBotOperation(currentState, { ...context, decisionTick: currentState.tick });
        context.randomState = decision.nextRandomState;
        game.handleAction(botId, decision.operation);
      }
    });
    game.onFrameSnapshot((snapshot) => {
      if (!this.roundRecording || this.game !== game) return;
      const operations: BombermanReplayFrame["operations"] = [];
      for (const [playerId, playerOperations] of Object.entries(snapshot)) {
        for (const operation of playerOperations) operations.push({ playerId, operation });
      }
      this.roundRecording.frames.push({ tick: game.getState().tick, operations });
    });
    game.onTick((currentState) => {
      const syncData = game.getSyncData();
      for (const playerId of this.sync.getConnectedPlayerIds()) {
        this.sync.sendToPlayer(playerId, currentState, currentState.tick, syncData[playerId]?.lastConfirmedOp ?? 0);
      }
      this.sync.broadcastToAllSpectators(currentState, currentState.tick);
    });
    game.onEnd((result) => this.handleGameEnd(game, result));
    const deadline = startedAt ?? Date.now() + 3_000;

    // Broadcast ROUND_STARTED so reconnected (and all) clients connect game sync
    // for the new round. The first round's ROUND_STARTED is already broadcast by
    // BombermanRoom.handleClientAction, so skip when phase is "playing".
    if (this.room.getPhase() !== "playing") {
      this.room.broadcastCustom({
        type: BombermanPreGameServerEventType.ROUND_STARTED,
        startedAt: deadline,
        match: structuredClone(this.room.getState().match),
      });
    }

    this.chat.addSystemMessage(
      "chat.bomberman.roundStarted",
      { round: String(match.currentRound) },
      {
        scope: "game",
        fallbackContent: `Round ${match.currentRound} started`,
      },
    );
    const delay = Math.max(0, deadline - Date.now());
    this.roundStartTimer = setTimeout(() => {
      this.roundStartTimer = undefined;
      if (this.game === game) game.startTicking();
    }, delay);
  }

  private async resolveMatchMaps(config: BombermanConfig): Promise<MapResolution> {
    const source = config.mapSource;
    if (source.type === "rotation") {
      if (source.maps.length === 0) return { ok: false, reason: "MAP_INVALID", issues: [] };
      const maps: BombermanMapDefinition[] = [];
      for (const ref of source.maps) {
        const resolved = await this.resolveMapRef(ref, config);
        if (!resolved.ok) return resolved;
        maps.push(resolved.map);
      }
      return { ok: true, maps };
    }
    const resolved =
      source.type === "procedural"
        ? this.generateMap(config, source.themeId, fnv1a(`${this.gameId}:procedural`))
        : await this.resolveMapRef(source, config);
    return resolved.ok ? { ok: true, maps: [resolved.map] } : resolved;
  }

  private generateMap(config: BombermanConfig, themeId: string, seed: number): SingleMapResolution {
    if (!BOMBERMAN_THEME_MANIFEST.some((theme) => theme.id === themeId)) {
      return { ok: false, reason: "MAP_INVALID", issues: [] };
    }
    try {
      const map = generateBombermanMap({
        width: config.mapWidth,
        height: config.mapHeight,
        themeId,
        softWallDensity: themeId === "night" ? 0.45 : 0.55,
        random: new Mulberry32(seed),
      });
      return { ok: true, map };
    } catch {
      return { ok: false, reason: "MAP_INVALID", issues: [] };
    }
  }

  private async resolveMapRef(ref: BombermanMapRef, config: BombermanConfig): Promise<SingleMapResolution> {
    if (ref.type === "workshop") {
      const map = await mapService.loadMapData(ref.id, "bomberman");
      if (!map) return { ok: false, reason: "MAP_NOT_FOUND" };
      try {
        const issues = validateBombermanMapDefinition(map);
        return issues.length > 0 ? { ok: false, reason: "MAP_INVALID", issues } : { ok: true, map };
      } catch {
        return { ok: false, reason: "MAP_INVALID", issues: [] };
      }
    }
    const definition = BOMBERMAN_PRESET_DEFINITIONS[ref.id];
    if (!definition) return { ok: false, reason: "MAP_NOT_FOUND" };
    return this.generateMap(config, definition.themeId, definition.seed);
  }

  private rejectStart(
    reason: "INVALID_PLAYER_COUNT" | "MAP_NOT_FOUND" | "MAP_INVALID",
    issues?: BombermanMapValidationIssue[],
  ): void {
    const event: BombermanPreGameServerEvent = {
      type: BombermanPreGameServerEventType.START_REJECTED,
      reason,
      ...(issues && issues.length > 0 ? { mapIssues: issues } : {}),
    };
    this.room.broadcastCustom(event);
    this.chat.addSystemMessage(
      "chat.bomberman.startRejected",
      { reason },
      {
        fallbackContent: `Game start rejected: ${reason}`,
      },
    );
    if (this.room.getPhase() === "playing") this.room.resumeGame();
  }

  private handleGameEnd(game: BombermanGame, result: BombermanGameEndResult): void {
    if (this.game !== game || this.destroyed) return;
    const roundResult = this.makeRoundResult(result);
    if (this.replayId && this.roundRecording) {
      const replayRound: BombermanReplayRound = { ...this.roundRecording, result: roundResult };
      bombermanReplayService.appendRound(this.replayId, replayRound);
      this.roundRecording = null;
    }
    // Tear down the finished game before scheduling the next round. cleanupRound
    // clears the startup timer, so doing this after handleRoundEnd would cancel
    // the five-second between-rounds deadline just installed there.
    this.cleanupRound(game);
    this.handleRoundEnd(result);
  }

  private makeRoundResult(result: BombermanGameEndResult) {
    return {
      roundNumber: this.room.getState().match.currentRound,
      attempt: this.room.getState().match.currentAttempt,
      winner: this.getWinner(result.winnerId),
      reason: result.reason,
      ticks: result.state.tick,
    } as const;
  }

  private getWinner(playerId: PlayerId | null): BombermanWinner | null {
    if (!playerId) return null;
    const player = this.room.getPlayers().find((candidate) => candidate.id === playerId);
    if (!player) return null;
    return this.room.getConfig().teamMode === "team"
      ? { kind: "team", id: player.teamId }
      : { kind: "player", id: player.id };
  }

  private cleanupRound(game: BombermanGame): void {
    if (this.roundStartTimer) clearTimeout(this.roundStartTimer);
    this.roundStartTimer = undefined;
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    this.sync.destroy();
    game.destroy();
    if (this.game === game) this.game = null;
    this.gamePlayerIds.clear();
    this.chat.activeStageInstance = this.createChatRoster();
  }

  /** Handle a completed round and advance the match, preserving draws as attempts. */
  public handleRoundEnd(result: BombermanGameEndResult): void {
    const state = this.room.getState();
    const match = state.match;
    const roundResult = this.makeRoundResult(result);
    match.roundResults.push(roundResult);
    match.nextRoundStartsAt = null;
    this.chat.addSystemMessage(
      "chat.bomberman.roundEnded",
      { round: String(roundResult.roundNumber) },
      {
        scope: "game",
        fallbackContent: `Round ${roundResult.roundNumber} ended`,
      },
    );

    if (roundResult.reason === "draw" || !roundResult.winner) {
      match.currentAttempt += 1;
      match.nextRoundStartsAt = Date.now() + 5_000;
      this.room.enterBetweenRounds();
      this.room.broadcastCustom({
        type: BombermanPreGameServerEventType.ROUND_ENDED,
        result: roundResult,
        match: structuredClone(match),
      });
      this.scheduleNextRound(match.nextRoundStartsAt);
      return;
    }

    const score = match.scores.find(
      (entry) => entry.competitor.kind === roundResult.winner?.kind && entry.competitor.id === roundResult.winner.id,
    );
    if (score) score.wins += 1;
    else match.scores.push({ competitor: roundResult.winner, wins: 1 });
    if (
      match.scores.some(
        (entry) =>
          entry.competitor.kind === roundResult.winner?.kind &&
          entry.competitor.id === roundResult.winner.id &&
          entry.wins >= match.targetWins,
      )
    ) {
      match.winner = roundResult.winner;
      match.nextRoundStartsAt = null;
      const rankings = this.makeRankings(match);
      this.room.broadcastCustom({
        type: BombermanPreGameServerEventType.MATCH_ENDED,
        match: structuredClone(match),
        rankings,
      });
      this.chat.addSystemMessage("chat.bomberman.matchEnded", undefined, {
        fallbackContent: "Match ended",
      });
      if (this.replayId) {
        bombermanReplayService.complete(this.replayId, match, match.winner);
        this.replayId = null;
      }
      this.room.resumeGame();
      return;
    }

    match.currentRound += 1;
    match.currentAttempt = 1;
    match.nextRoundStartsAt = Date.now() + 5_000;
    this.room.enterBetweenRounds();
    this.room.broadcastCustom({
      type: BombermanPreGameServerEventType.ROUND_ENDED,
      result: roundResult,
      match: structuredClone(match),
    });
    this.scheduleNextRound(match.nextRoundStartsAt);
  }

  private scheduleNextRound(startsAt: number): void {
    if (this.roundStartTimer) clearTimeout(this.roundStartTimer);
    this.roundStartTimer = setTimeout(
      () => {
        this.roundStartTimer = undefined;
        if (!this.destroyed && this.room.getPhase() === "between_rounds")
          void this.startGame(undefined, Date.now() + 3_000);
      },
      Math.max(0, startsAt - Date.now()),
    );
  }

  private makeRankings(match: BombermanMatchState): BombermanMatchRanking[] {
    const membersByTeam = new Map<TeamId, PlayerId[]>();
    for (const player of this.room.getPlayers()) {
      const members = membersByTeam.get(player.teamId) ?? [];
      members.push(player.id);
      membersByTeam.set(player.teamId, members);
    }
    return [...match.scores]
      .map((score) => ({
        competitor: score.competitor,
        memberIds:
          score.competitor.kind === "team" ? (membersByTeam.get(score.competitor.id) ?? []) : [score.competitor.id],
        wins: score.wins,
        rank: 0,
      }))
      .sort((left, right) => right.wins - left.wins)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  public setRoomUpdateEmitter(cb: (gameId: string) => void): void {
    this.roomUpdateEmitter = cb;
  }

  getPhase(): string {
    return this.room.getPhase();
  }

  getSummary() {
    const state = this.room.getState();
    return {
      gameId: this.gameId,
      roomName: state.roomName,
      playerCount: state.players.length,
      maxPlayers: state.maxPlayers,
      phase: state.phase,
      hostName: state.players.find((player) => player.isHost)?.name ?? "",
      hasPassword: !!this.room.getPassword(),
    };
  }
  getPlayerCount(): number {
    return this.room.getPlayers().length;
  }

  prepConnectionForPlayer(userid: string, requestedRole?: "player" | "spectator") {
    const phase = this.room.getPhase();
    const player = this.room.getPlayers().find((candidate) => candidate.id === userid);
    const spectator = this.room.getSpectators().some((candidate) => candidate.id === userid);
    const role: "player" | "spectator" =
      spectator || requestedRole === "spectator" || player?.status === "spectating" ? "spectator" : "player";
    const inGame = phase === "playing" && (role === "spectator" || !!player);
    return {
      success: true as const,
      data: {
        playerId: userid,
        phase,
        hasPassword: !!this.room.getPassword(),
        role,
        domains: {
          primary: inGame ? `game-${this.gameId}` : `room-${this.gameId}`,
          game: `game-${this.gameId}`,
          chat: `chat-${this.gameId}`,
        },
      },
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.roundStartTimer) clearTimeout(this.roundStartTimer);
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    if (this.replayId) {
      bombermanReplayService.discard(this.replayId);
      this.replayId = null;
    }
    unregisterDomainHandler(`room-${this.gameId}`);
    unregisterDomainHandler(`game-${this.gameId}`);
    unregisterDomainHandler(`chat-${this.gameId}`);
    this.chat.destroy();
    this.room.destroy();
    this.sync.destroy();
    this.game?.destroy();
    this.onDisband?.();
  }
}
