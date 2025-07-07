import { GameState, PlayerActionQueues, PlayerOperationType, TileType, MaskedGameState, PlayerStatus, PlayerId } from "@generale/types";
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
        // Using optional chaining ?. for a cleaner check
        if (newState.players[pid]?.status !== PlayerStatus.Playing) {
            newQueues[pid] = []; 
            continue;
        }
        if (ops.length === 0) {
            newQueues[pid] = ops;
            continue;
        }

        const op = ops[0];
        // FIX (for errors on lines 30, 32, 36): Add a guard. If the ops array was somehow
        // modified to be empty, this prevents 'op' from being undefined.
        if (!op) {
            continue;
        }

        let ok = false;
        switch (op.type) { // This access is now safe
            case PlayerOperationType.Move:
                ok = handleMove(newState, pid, op.payload);
                break;
            // case … 以后扩展
            default:
                // This access is now safe
                throw new Error(`Unknown op type ${op.type} of op ${op}`)
        }

        // 更新最后活跃 tick
        // FIX: Add a check to ensure the player still exists before updating them,
        // as they might have been defeated during this tick's operations.
        const player = newState.players[pid];
        if (ok && player) {
            player.lastActiveTick = newState.tick;
        }

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

    // FIX: Add a guard to ensure 'player' exists. This resolves all subsequent errors.
    if (!player) {
        // If the player is not found, returning the unmodified map is a safe default.
        return copy;
    }

    const teamId = player.teamId;
    const team = teamId ? state.teams[teamId] : null;

    // 地图遮蔽
    for (let y = 0; y < copy.map.height; y++) {
        for (let x = 0; x < copy.map.width; x++) {
            const t = copy.map.tiles[y]![x]!;

            // This logic is now safe because the guard above ensures 'player' and 'team' are handled correctly.
            const isOwnedByTeammate = !!(team && t.ownerId && team.memberIds.includes(t.ownerId));
            
            const shouldHide = !(t.ownerId === playerId || isOwnedByTeammate) && 
                              !isAdjacentToPlayer(state, playerId, { x, y });
            
            if (shouldHide) {
                copy.map.tiles[y]![x] = {
                    type: TileType.Fog,
                    ownerId: null,
                    army: 0,
                };
            }
        }
    }

    return copy;
}