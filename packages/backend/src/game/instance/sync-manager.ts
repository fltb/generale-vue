/**
 * GameSyncManager — game-agnostic sync layer.
 *
 * Manages connector lifecycle (add/remove/displace), per-player patch/snapshot
 * state sync (via StateSyncState), disconnect tracking, and spectator support.
 *
 * Does NOT manage: game state, tick logic, action handling, fog-of-war masking.
 * Those remain in the game instance/service.
 *
 * Replaces the ~200 lines of duplicated connector-management code between
 * GeneraleGame and BombermanService.
 */

import type { PlayerId } from "@generale/types";
import { StateSyncState } from "./state-sync";
import { displaceConnector } from "./connector-manager";

// ── Connector interface ──

export interface SyncConnector {
  send(payload: unknown): void;
  close(): void;
  onOpen(cb: () => void): void;
  onDisconnect(cb: () => void): void;
  onReconnect(cb: () => void): void;
  onClose(cb: () => void): void;
}

// ── Send helpers — callbacks the game provides to format wire messages ──

export interface SyncSendHelpers<TState extends object> {
  /** Format and send a snapshot STATE_UPDATE message */
  sendSnapshot: (conn: SyncConnector, state: TState, version: number, confirmedOp: number) => void;
  /** Format and send a patch STATE_UPDATE message */
  sendPatch: (
    conn: SyncConnector,
    patches: import("fast-json-patch").Operation[],
    version: number,
    confirmedOp: number,
  ) => void;
}

// ── Options ──

export interface GameSyncManagerOptions<TState extends object> {
  /** Wire-format helpers for snapshot and patch messages */
  send: SyncSendHelpers<TState>;
  /** Unique string for the "displaced" custom event type (game-specific) */
  customEventType: string;
  /** Unique string for the DISPLACED payload type */
  displacedPayloadType: string;
}

// ── Manager ──

export class GameSyncManager<TState extends object> {
  // player connectors
  private connectors = new Map<PlayerId, SyncConnector>();
  private stateSync = new StateSyncState<TState>();
  private disconnected = new Set<PlayerId>();
  private destroyed = false;

  // spectator connectors (optional feature — just don't call addSpectator to disable)
  private spectatorConnectors = new Map<PlayerId, SyncConnector>();
  private spectatorStateSync = new StateSyncState<TState>();
  private spectatorDisconnected = new Set<PlayerId>();

  // config
  private send: SyncSendHelpers<TState>;
  private customEventType: string;
  private displacedPayloadType: string;

  constructor(options: GameSyncManagerOptions<TState>) {
    this.send = options.send;
    this.customEventType = options.customEventType;
    this.displacedPayloadType = options.displacedPayloadType;
  }

  // ══════════════════════════════════════════════════════
  //  Player lifecycle
  // ══════════════════════════════════════════════════════

  /**
   * Add or displace a player connector.
   * Handles the write-then-close displacement pattern and hooks up
   * onOpen/onDisconnect/onReconnect/onClose callbacks.
   *
   * @param pid player id
   * @param connector the new connector
   * @param onAction called when client sends an action message (game-specific parsing)
   */
  addPlayer(pid: PlayerId, connector: SyncConnector): void {
    if (this.destroyed) return;

    // displacement: write new connector, clear sync state, close stale
    this.stateSync.clear(pid);
    displaceConnector(
      pid,
      connector,
      this.connectors,
      this.stateSync,
      new Map(),
      this.customEventType,
      this.displacedPayloadType,
    );

    connector.onOpen(() => {
      this.disconnected.delete(pid);
    });

    connector.onDisconnect(() => {
      this.disconnected.add(pid);
    });

    connector.onReconnect(() => {
      this.disconnected.delete(pid);
    });

    connector.onClose(() => {
      // Prevent stale onClose from affecting a replacement connector
      if (this.connectors.get(pid) !== connector) return;
      this.removePlayer(pid);
    });
  }

  removePlayer(pid: PlayerId): void {
    this.connectors.delete(pid);
    this.stateSync.clear(pid);
    this.disconnected.delete(pid);
  }

  // ══════════════════════════════════════════════════════
  //  Spectator lifecycle
  // ══════════════════════════════════════════════════════

  addSpectator(sid: PlayerId, connector: SyncConnector): void {
    if (this.destroyed) return;

    this.spectatorStateSync.clear(sid);
    this.spectatorDisconnected.delete(sid);
    displaceConnector(
      sid,
      connector,
      this.spectatorConnectors,
      this.spectatorStateSync,
      new Map(),
      this.customEventType,
      this.displacedPayloadType,
    );

    connector.onOpen(() => {
      this.spectatorDisconnected.delete(sid);
    });
    connector.onDisconnect(() => {
      this.spectatorDisconnected.add(sid);
    });
    connector.onReconnect(() => {
      this.spectatorDisconnected.delete(sid);
    });
    connector.onClose(() => {
      if (this.spectatorConnectors.get(sid) !== connector) return;
      this.removeSpectator(sid);
    });
  }

  removeSpectator(sid: PlayerId): void {
    const conn = this.spectatorConnectors.get(sid);
    if (conn) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    this.spectatorConnectors.delete(sid);
    this.spectatorStateSync.clear(sid);
    this.spectatorDisconnected.delete(sid);
  }

  // ══════════════════════════════════════════════════════
  //  State broadcast (patch/snapshot)
  // ══════════════════════════════════════════════════════

  /**
   * Send state to a single player (patch or snapshot, automatically selected).
   */
  sendToPlayer(pid: PlayerId, state: TState, version: number, confirmedOp: number, forceSnapshot = false): void {
    if (this.disconnected.has(pid)) return;
    const conn = this.connectors.get(pid);
    if (!conn) return;

    this.stateSync.send(
      pid,
      forceSnapshot,
      state,
      version,
      confirmedOp,
      (s, ver, op) => this.send.sendSnapshot(conn, s, ver, op),
      (patches, ver, op) => this.send.sendPatch(conn, patches, ver, op),
    );
  }

  /**
   * Send state to a single spectator.
   */
  sendToSpectator(sid: PlayerId, state: TState, version: number, forceSnapshot = false): void {
    if (this.spectatorDisconnected.has(sid)) return;
    const conn = this.spectatorConnectors.get(sid);
    if (!conn) return;

    this.spectatorStateSync.send(
      sid,
      forceSnapshot,
      state,
      version,
      0, // spectators have no confirmedOp
      (s, ver, op) => this.send.sendSnapshot(conn, s, ver, op),
      (patches, ver, op) => this.send.sendPatch(conn, patches, ver, op),
    );
  }

  /**
   * Broadcast the same state to ALL connected players (e.g. for Bomberman where
   * every player sees the same state).
   */
  broadcastToAllPlayers(state: TState, version: number, confirmedOp: number): void {
    for (const pid of this.connectors.keys()) {
      try {
        this.sendToPlayer(pid, state, version, confirmedOp);
      } catch (e) {
        console.warn(`[GameSyncManager] sendToPlayer error for ${pid}`, e);
      }
    }
  }

  /**
   * Broadcast to all spectators.
   */
  broadcastToAllSpectators(state: TState, version: number): void {
    for (const sid of this.spectatorConnectors.keys()) {
      try {
        this.sendToSpectator(sid, state, version);
      } catch (e) {
        console.warn(`[GameSyncManager] sendToSpectator error for ${sid}`, e);
      }
    }
  }

  // ══════════════════════════════════════════════════════
  //  Custom event broadcast
  // ══════════════════════════════════════════════════════

  /**
   * Send a custom event (e.g. GAME_ENDED) to all players + spectators.
   */
  broadcastEvent(event: unknown): void {
    for (const conn of this.connectors.values()) {
      try {
        conn.send(event);
      } catch (e) {
        console.warn("[GameSyncManager] broadcastEvent player send error", e);
      }
    }
    for (const conn of this.spectatorConnectors.values()) {
      try {
        conn.send(event);
      } catch (e) {
        console.warn("[GameSyncManager] broadcastEvent spectator send error", e);
      }
    }
  }

  // ══════════════════════════════════════════════════════
  //  Queries
  // ══════════════════════════════════════════════════════

  isDisconnected(pid: PlayerId): boolean {
    return this.disconnected.has(pid);
  }

  getConnectedPlayerIds(): PlayerId[] {
    return [...this.connectors.keys()].filter((pid) => !this.disconnected.has(pid));
  }

  getPlayerConnector(pid: PlayerId): SyncConnector | undefined {
    return this.connectors.get(pid);
  }

  // ══════════════════════════════════════════════════════
  //  Lifecycle
  // ══════════════════════════════════════════════════════

  destroy(): void {
    this.destroyed = true;
    for (const [, conn] of this.connectors) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    for (const [, conn] of this.spectatorConnectors) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    this.connectors.clear();
    this.stateSync.clearAll();
    this.disconnected.clear();
    this.spectatorConnectors.clear();
    this.spectatorStateSync.clearAll();
    this.spectatorDisconnected.clear();
  }
}
