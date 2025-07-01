import { GameState, PlayerActionQueues, PlayerOperationType, MoveOperationPayload, TileType, MaskedGameState, PlayerStatus, PlayerId } from "@generale/types";
import { handleMove, isAdjacentToPlayer, updateGameState } from "./game-utils";


/**
 * 进度推进函数
 * @param state  当前快照
 * @param queues 本 tick 各玩家操作队列
 * @returns 新的 state 和剩余队列
 */
export function tick(
    state: GameState,
    queues: PlayerActionQueues
): { state: GameState; queue: PlayerActionQueues } {
    // 深拷贝保证纯函数
    const newState: GameState = structuredClone(state);
    const newQueues: PlayerActionQueues = {};

    for (const [pid, ops] of Object.entries(queues)) {
        if (newState.players[pid]?.status !== PlayerStatus.Playing) {
            newQueues[pid] = []; continue;
        }
        if (ops.length === 0) {
            newQueues[pid] = ops;
            continue;
        }

        const op = ops[0];
        let ok = false;
        switch (op.type) {
            case PlayerOperationType.Move:
                ok = handleMove(newState, pid, op.payload as MoveOperationPayload);
                break;
            // case … 以后扩展
            default:
                throw new Error(`Unknown op type ${op.type} of op ${op}`)
        }

        // 更新最后活跃 tick
        if (ok) newState.players[pid].lastActiveTick = newState.tick;

        // 仅在成功时消费该操作
        newQueues[pid] = ok ? ops.slice(1) : [];
    }

    updateGameState(newState);
    return { state: newState, queue: newQueues };
}


/**
 * 生成单个玩家视角的战雾快照
 */
export function mask(state: GameState, playerId: PlayerId): MaskedGameState {
    const copy = structuredClone(state);
    const player = state.players[playerId];
    const teamId = player.teamId;
    const team = teamId ? state.teams[teamId] : null;

    // 地图遮蔽
    for (let y = 0; y < copy.map.height; y++) {
        for (let x = 0; x < copy.map.width; x++) {
            const t = copy.map.tiles[y][x];
            const isOwnedByTeammate = team && t.ownerId && team.memberIds.includes(t.ownerId);
            const shouldHide = !(t.ownerId === playerId || isOwnedByTeammate) && 
                              !isAdjacentToPlayer(state.map, playerId, { x, y });
            
            if (shouldHide) {
                copy.map.tiles[y][x] = {
                    type: TileType.Fog,
                    ownerId: null,
                    army: 0,
                };
            }
        }
    }

    return copy;
}