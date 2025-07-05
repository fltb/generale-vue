import {
    GameState,
    MaskedGameState,
    PlayerActionQueues,
    PlayerOperation,
    PlayerId,
    SyncedGameServerEvent,
    SyncedGameServerStateUpdatePayloadType,
    SyncedGameServerEventType,
    ServerSyncConnector,
    SyncedGameClientActions,
    SyncedGameState
} from '@generale/types';
import { tick, mask } from '../core';
import { enablePatches, produceWithPatches } from 'immer';

enablePatches();

type GameServerConnector = ServerSyncConnector<SyncedGameClientActions, SyncedGameServerEvent>;

export interface GameInstanceSettings {
    playerDisplay: SyncedGameState['playerDisplay'];
}

interface SyncEntry {
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

            conn.onOpen(() => this.sendState(pid, true));
            conn.onDisconnect(() => this.disconnected.add(pid));
            conn.onReconnect(() => {
                this.disconnected.delete(pid);
                this.sendState(pid, true);
            });
            conn.onClientMessage(evt => this.handleClientEvent(pid, evt as any));
            conn.onClose(() => this.connectors.delete(pid));
        }
    }

    private handleClientEvent(pid: PlayerId, evt: { operations: PlayerOperation[] }) {
        const synced = this.playerSyncedStates.get(pid)!;
        synced.playerOperationQueue = [...synced.playerOperationQueue, ...evt.operations];
    }

    /**
     * 根据上次同步状态与当前 state，自动计算并发送全量或增量
     * forceSnapshot: 是否强制发送全量
     */
    private sendState(pid: PlayerId, forceSnapshot = false) {
        if (this.disconnected.has(pid)) return;
        const conn = this.connectors.get(pid);
        if (!conn) return;

        // 上次已同步的客户端视图
        const prevEntry = this.syncData.get(pid);
        const prevState = prevEntry?.syncedState;
        const newState: SyncedGameState = {
            ...mask(this.state, pid),
            playerDisplay: this.settings.playerDisplay,
            playerOperationQueue: prevState
                ? prevState.playerOperationQueue
                : []  // 首次无旧条目则空队列
        };

        // 比对补丁
        const [_, patches] = produceWithPatches(prevState ?? newState, draft => {
            Object.assign(draft, newState);
        });

        // 计算 confirmedOp
        const oldIds = prevState
            ? prevState.playerOperationQueue.map(op => op.optimisticId)
            : [];
        const newIds = newState.playerOperationQueue.map(op => op.optimisticId);
        const removed = oldIds.filter(id => !newIds.includes(id));
        const confirmed = removed.length > 0
            ? Math.max(...removed)
            : prevEntry?.lastConfirmedOp ?? 0;

        // 全局版本自增
        this.version++;
        const payloadBase = { version: this.version, confirmedOp: confirmed };

        // 决定首次或强制发快照，或差异发增量
        const isFirst = !prevEntry;
        if (isFirst || forceSnapshot || patches.length === 0) {
            conn.send({
                type: SyncedGameServerEventType.STATE_UPDATE,
                payload: {
                    type: SyncedGameServerStateUpdatePayloadType.SNAPSHOT,
                    ...payloadBase,
                    payload: newState
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

        // 更新 syncData 条目
        this.syncData.set(pid, {
            lastConfirmedOp: confirmed,
            syncedState: newState
        });
    }

    /** 推进游戏并触发同步 */
    public advance() {
        const queues: PlayerActionQueues = {};
        for (const [pid, synced] of this.syncData) {
            queues[pid] = synced.syncedState.playerOperationQueue;
        }
        const { state: newState } = tick(this.state, queues);
        this.state = newState;
        this.version++;

        // 对所有玩家发送状态
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
