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
    SyncedGameClientActions

} from '@generale/types';
import { tick, mask } from '../core';
import { enablePatches, produceWithPatches, Patch } from 'immer';

// 启用补丁功能
enablePatches();


type GameServerConnector = ServerSyncConnector<SyncedGameClientActions, SyncedGameServerEvent>

/**
 * 管理多玩家游戏实例，支持断线重连与增量更新
 */
export class GameInstance {
    private state: GameState;
    private queues: PlayerActionQueues;
    private connectors: Map<PlayerId, GameServerConnector> = new Map();
    private version = 0;

    constructor(initialState: GameState) {
        this.state = structuredClone(initialState);
        this.queues = {};
    }

    /** 注册玩家连接器并设置监听 */
    public registerConnector(
        playerId: PlayerId,
        connector: GameServerConnector
    ) {
        this.connectors.set(playerId, connector);
        connector.onOpen(ctx => this.sendSnapshot(playerId));
        connector.onClientMessage((evt, ctx) => this.handleClientEvent(playerId, evt as any));
        connector.onClose(() => this.connectors.delete(playerId));
    }

    /** 入队玩家操作 */
    private handleClientEvent(playerId: PlayerId, evt: { operations: PlayerOperation[] }) {
        this.queues[playerId] = [...(this.queues[playerId] || []), ...evt.operations];
    }

    /** 推送完整快照 */
    private sendSnapshot(playerId: PlayerId) {
        const connector = this.connectors.get(playerId);
        if (!connector) return;
        const sevt: SyncedGameServerEvent = {
            type: SyncedGameServerEventType.STATE_UPDATE, payload: {
                type: SyncedGameServerStateUpdatePayloadType.SNAPSHOT,
                version: ++this.version,
                confirmedOp: this.version,
                payload: mask(this.state, playerId),
            }
        };
        connector.send(sevt);
    }

    /** 推送增量 Patch */
    private sendPatch(playerId: PlayerId, patches: Patch[]) {
        const connector = this.connectors.get(playerId);
        if (!connector) return;
        const sevt: SyncedGameServerEvent = {
            type: SyncedGameServerEventType.STATE_UPDATE, payload: {
                type: SyncedGameServerStateUpdatePayloadType.PATCH,
                version: ++this.version,
                confirmedOp: this.version,
                payload: patches,
            }
        };
        connector.send(sevt);
    }

    /** 推进游戏：执行操作并向所有玩家推送增量或快照 */
    public advance() {
        const prevState = this.state;
        const { state: newState, queue: newQueues } = tick(this.state, this.queues);
        this.state = newState;
        this.queues = newQueues;

        // 使用 produceWithPatches 计算前后状态差异补丁
        const [_, patches] = produceWithPatches(prevState, draft => {
            // 将 newState 的内容合并到 draft
            Object.assign(draft, newState);
        });

        // 对每个玩家发送针对性的增量或完整快照
        for (const playerId of this.connectors.keys()) {
            if (patches.length) {
                this.sendPatch(playerId, patches);
            } else {
                this.sendSnapshot(playerId);
            }
        }
    }

    /** 获取玩家视角的遮雾快照 */
    public getMaskedState(playerId: PlayerId): MaskedGameState {
        return mask(this.state, playerId);
    }
}
