import { GameState, MoveOperationPayload, Coordinates, TileType, PlayerStatus, PlayerId, GameMap } from "@generale/types";


/** 坐标是否相邻（四方向） */
export function areAdjacent(a: Coordinates, b: Coordinates): boolean {
    return (
        (Math.abs(a.x - b.x) === 1 && a.y === b.y) ||  // Horizontal
        (Math.abs(a.y - b.y) === 1 && a.x === b.x)     // Vertical
    );
}

export function playerDefeatedBy(state: GameState, DefeatedPlayerId: PlayerId, winnerPlayerId: PlayerId | null) {
    const { map, players } = state;
    const player = players[DefeatedPlayerId];
    player.status = PlayerStatus.Defeated;
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            if (map.tiles[y][x].ownerId === player.id) {
                map.tiles[y][x].ownerId = winnerPlayerId;
                if (map.tiles[y][x].type == TileType.Throne) {
                    map.tiles[y][x].type = TileType.Barracks // 只能有一个王座
                }
                // 兵力不会置零，因为需要占领
            }
        }
    }
}

/** 校验一次 MOVE 操作是否合法 */
export function validateMove(state: GameState, playerId: PlayerId, p: MoveOperationPayload): boolean {
    const { from, to, percentage } = p;
    // 坐标范围
    if (
        from.x < 0 || from.x >= state.map.width ||
        from.y < 0 || from.y >= state.map.height ||
        to.x < 0 || to.x >= state.map.width ||
        to.y < 0 || to.y >= state.map.height
    ) return false;

    const src = state.map.tiles[from.y][from.x];
    const dst = state.map.tiles[to.y][to.x];

    // 拥有权、不可去山地、相邻、百分比合法
    return src.ownerId === playerId
        && dst.type !== TileType.Mountain
        && areAdjacent(from, to)
        && percentage >= 1 && percentage <= 100
        // 保留至少 1 兵
        && src.army > 1;
}

/** 执行一次 MOVE（假设已 validate） */
export function handleMove(state: GameState, playerId: PlayerId, p: MoveOperationPayload): boolean {
    if (!validateMove(state, playerId, p)) {
        return false;
    }
    const { from, to, percentage } = p;
    const src = state.map.tiles[from.y][from.x];
    const dst = state.map.tiles[to.y][to.x];

    // 计算移动数
    const moving = Math.min(Math.floor(src.army * (percentage / 100)), src.army - 1);
    if (moving <= 0) {
        return false;
    }
    src.army -= moving;

    const player = state.players[playerId];

    if (dst.ownerId === playerId) {
        // 己方地块，合并
        dst.army += moving;
    } else if (player.teamId && dst.ownerId && state.players[dst.ownerId]?.teamId === player.teamId) {
        // 队友地块
        if (dst.type === TileType.Throne) {
            // 王座：兵力给队友
            dst.army += moving;
        } else {
            // 普通地块：吸收队友兵力
            dst.army += moving;
            dst.ownerId = playerId;
        }
    } else {
        // 中立或他人：战斗
        if (moving > dst.army) {
            dst.army = moving - dst.army;
            if (dst.type === TileType.Throne) {
                playerDefeatedBy(state, dst.ownerId!, playerId);
            } else { // change owner
                dst.ownerId = playerId;
            }
        } else {
            dst.army -= moving;
            // 归属不变
        }
    }
    return true;
}

/** 全图产兵、特殊地块处理、玩家统计、断线踢出、胜利判定 */
export function updateGameState(state: GameState): void {
    const { map, settings, players, tick } = state;

    // —— 地块产兵 & 特殊地块效果 ——  
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tile = map.tiles[y][x];
            // 只有有人拥有才产兵或者损耗兵力（growth 为负数）
            if (tile.ownerId) {
                const cfg = settings.tileGrow[tile.type];
                tile._internalCounter = (tile._internalCounter || 0) + 1;
                if (tile._internalCounter >= cfg.duration) {
                    tile.army += cfg.growth;
                    if (tile.army <= 0) {
                        // 说明该地块不应该属于玩家了，转为普通
                        tile.ownerId = null;
                    }
                    tile._internalCounter = 0;
                }
            }
        }
    }

    // —— 玩家统计 & 挂机检测 ——  
    for (const player of Object.values(players)) {
        let sumArmy = 0, sumLand = 0;
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const t = map.tiles[y][x];
                if (t.ownerId === player.id) {
                    sumArmy += t.army;
                    sumLand += 1;
                }
            }
        }
        player.army = sumArmy;
        player.land = sumLand;

        // 断线超时则判负并收回地块
        const last = player.lastActiveTick ?? tick;
        if (player.status === PlayerStatus.Playing
            && tick - last > settings.afkThreshold) {
            playerDefeatedBy(state, player.id, null);
        }
    }

    state.tick++;
}

/** 判断某格与玩家地块是否相邻，用于战争迷雾 */
export function isAdjacentToPlayer(map: GameMap, playerId: PlayerId, c: Coordinates): boolean {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = c.x + dx, y = c.y + dy;
            if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
                if (map.tiles[y][x].ownerId === playerId) return true;
            }
        }
    }
    return false;
}
