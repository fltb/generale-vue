import {
    GameState,
    MaskedGameState,
    PlayerActionQueues,
    PlayerId,
    SyncedGameServerEvent,
    SyncedGameServerStateUpdatePayloadType,
    SyncedGameServerEventType,
    ServerSyncConnector,
    SyncedGameClientActions,
    SyncedGameState,
    SyncedGameClientActionTypes
} from '@generale/types';
import { tick, mask } from '../core';
import { GameStatus } from '@generale/types';
import { compare } from 'fast-json-patch';

type GameServerConnector = ServerSyncConnector<SyncedGameClientActions, SyncedGameServerEvent>;

export interface GameInstanceSettings {
    playerDisplay: SyncedGameState['playerDisplay'];
}

export interface SyncEntry {
    lastConfirmedOp: number;
    syncedState: SyncedGameState;
}

/**
 * 管理多玩家游戏实例，自动根据差异推送全量或增量，并跟踪 confirmedOp
 */
export class GameInstance {
    private state: GameState;
    private version: number;
    private settings: GameInstanceSettings;
    private connectors: Map<PlayerId, GameServerConnector>;
    private syncData = new Map<PlayerId, SyncEntry>();
    private prevSentState = new Map<PlayerId, SyncedGameState>;
    private disconnected = new Set<PlayerId>();

    constructor(
        initialState: GameState,
        settings: GameInstanceSettings,
        connectors: Map<PlayerId, GameServerConnector>
    ) {
        this.state = structuredClone(initialState);
        this.settings = settings;
        this.version = 0;
        this.connectors = new Map(connectors);

        for (const [pid, conn] of this.connectors) {
            // init synced state & metadata
            const masked = mask(this.state, pid);
            this.syncData.set(pid, {
                lastConfirmedOp: 0,
                syncedState: {
                    ...masked,
                    playerDisplay: this.settings.playerDisplay,
                    playerOperationQueue: [],
                }
            })
            conn.onOpen(() => this.sendState(pid, true));
            conn.onDisconnect(() => this.disconnected.add(pid));
            conn.onReconnect(() => {
                this.disconnected.delete(pid);
                this.sendState(pid, true);
            });
            conn.onClientMessage(evt => this.handleClientEvent(pid, evt));
            conn.onClose(() => this.connectors.delete(pid));
        }
    }

    private handleClientEvent(pid: PlayerId, evt: SyncedGameClientActions) {
        const synced = this.syncData.get(pid)!;
        if (synced.lastConfirmedOp >= evt.optimisticId) {
            return;
        }
        switch (evt.type) {
            case SyncedGameClientActionTypes.PUSH: {
                synced.syncedState.playerOperationQueue = [...synced.syncedState.playerOperationQueue, ...evt.payload];
            } break;
            case SyncedGameClientActionTypes.CLEAN_ALL: {
                synced.syncedState.playerOperationQueue = [];
            } break;
        }
        synced.lastConfirmedOp = evt.optimisticId;
    }

    /**
     * 根据情况向客户端发送 this.syncData.get(pid)
     * 以 snapshot 或者 patch 的形式
     * forceSnapshot: 是否强制发送全量
     */
    private sendState(pid: PlayerId, forceSnapshot = false) {
        if (this.disconnected.has(pid)) return;
        const conn = this.connectors.get(pid);
        if (!conn) return;

        const entry = this.syncData.get(pid)!;
        const current = entry.syncedState;

        const payloadBase = {
            version: this.version,
            confirmedOp: entry.lastConfirmedOp
        };

        // 如果没有 prevSentState 或者强制 snapshot，就直接发全量
        if (!this.prevSentState.has(pid) || forceSnapshot) {
            conn.send({
                type: SyncedGameServerEventType.STATE_UPDATE,
                payload: {
                    type: SyncedGameServerStateUpdatePayloadType.SNAPSHOT,
                    ...payloadBase,
                    payload: current
                }
            });
            // 记录下来，供下次 diff
            this.prevSentState.set(pid, structuredClone(current));
            return;
        }

        const prev = this.prevSentState.get(pid)!;
        // 否则走 diff 流程
        const patches = compare(prev, current);

        // 临时的判断，以后会根据经验参数之类的方式判断是否发 snapshot
        if (patches.length > 1000) {
            conn.send({
                type: SyncedGameServerEventType.STATE_UPDATE,
                payload: {
                    type: SyncedGameServerStateUpdatePayloadType.SNAPSHOT,
                    ...payloadBase,
                    payload: current
                }
            });
        } else {
            conn.send({
                type: SyncedGameServerEventType.STATE_UPDATE,
                payload: {
                    type: SyncedGameServerStateUpdatePayloadType.PATCH,
                    ...payloadBase,
                    payload: patches
                }
            });
        }

        // 更新 prevSentState
        this.prevSentState.set(pid, structuredClone(current));
    }

    /** 推进游戏并触发同步 */
    public advance() {
        if (this.state.status === GameStatus.Ended) {
            return;
        }
        const queues: PlayerActionQueues = {};
        for (const [pid, synced] of this.syncData) {
            queues[pid] = synced.syncedState.playerOperationQueue;
        }
        const { state: newState, queue } = tick(this.state, queues);
        this.state = newState;
        this.version++;

        // 对所有玩家发送状态
        for (const pid of this.connectors.keys()) {
            const synced = this.syncData.get(pid)!;
            synced.syncedState.playerOperationQueue = queue[pid] ?? [];
            const masked = mask(this.state, pid);
            synced.syncedState = {
                ...synced.syncedState,
                ...masked,
            };
        }

        for (const pid of this.connectors.keys()) {
            this.sendState(pid);
        }
    }

    /** 获取当前服务端全局 state */
    public getState(): GameState {
        return this.state;
    }

    /** 获取指定玩家视角 */
    public getMaskedState(pid: PlayerId): MaskedGameState {
        return mask(this.state, pid);
    }
}
