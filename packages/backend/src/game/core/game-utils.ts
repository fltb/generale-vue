import { GameState, MoveOperationPayload, Coordinates, TileType, PlayerStatus, PlayerId, Tile, PlayerCore, GameStatus } from "@generale/types";


/** 坐标是否相邻（四方向） */
export function areAdjacent(a: Coordinates, b: Coordinates): boolean {
    return (
        (Math.abs(a.x - b.x) === 1 && a.y === b.y) ||  // Horizontal
        (Math.abs(a.y - b.y) === 1 && a.x === b.x)     // Vertical
    );
}

export function getTile(state: GameState, y: number, x: number): Tile | undefined {
    // 将边界检查封装在内部
    const row = state.map.tiles[y];
    if (!row) return undefined;
    return row[x];
}

/**
 * 不安全地获取一个地块。如果越界则抛出错误。
 * 在你确信坐标合法的地方使用，可以避免后续的 undefined 检查。
 */
export function getTileUnsafe(state: GameState, y: number, x: number): Tile {
    const tile = getTile(state, y, x);
    if (!tile) {
        throw new Error(`Attempted to access out-of-bounds tile at (${y}, ${x})`);
    }
    return tile;
}

export function getPlayer(state: GameState, playerId: PlayerId) : PlayerCore | undefined {
    return state.players[playerId];
}

export function getPlayerUnsage(state: GameState, playerId: PlayerId) : PlayerCore {
    return state.players[playerId]!;
}

export function playerDefeatedBy(state: GameState, DefeatedPlayerId: PlayerId, winnerPlayerId: PlayerId | null) {
    const { map } = state;
    const player = getPlayerUnsage(state, DefeatedPlayerId);
    player.status = PlayerStatus.Defeated;
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tile = getTileUnsafe(state, y, x);
            if (tile.ownerId === player.id) {
                tile.ownerId = winnerPlayerId;
                if (tile.type == TileType.Throne) {
                    tile.type = TileType.Barracks
                }
            }
        }
    }
}

/** 校验一次 MOVE 操作是否合法 */
export function validateMove(state: GameState, playerId: PlayerId, p: MoveOperationPayload): boolean {
    const { from, to, percentage } = p;
    if (
        from.x < 0 || from.x >= state.map.width ||
        from.y < 0 || from.y >= state.map.height ||
        to.x < 0 || to.x >= state.map.width ||
        to.y < 0 || to.y >= state.map.height
    ) return false;

    const src = getTileUnsafe(state, from.y, from.x);
    const dst = getTileUnsafe(state, to.y, to.x);

    return src.ownerId === playerId
        && dst.type !== TileType.Mountain
        && areAdjacent(from, to)
        && percentage >= 1 && percentage <= 100
        && src.army > 1;
}

/** 执行一次 MOVE（假设已 validate） */
export function handleMove(state: GameState, playerId: PlayerId, p: MoveOperationPayload): boolean {
    if (!validateMove(state, playerId, p)) {
        return false;
    }
    const { from, to, percentage } = p;
    const src = getTileUnsafe(state, from.y, from.x);
    const dst = getTileUnsafe(state, to.y, to.x);

    const moving = Math.min(Math.floor(src.army * (percentage / 100)), src.army - 1);
    if (moving <= 0) return false;
    src.army -= moving;

    const player = getPlayerUnsage(state, playerId);

    if (dst.ownerId === playerId) {
        dst.army += moving;
    } else if (player.teamId && dst.ownerId && state.players[dst.ownerId]?.teamId === player.teamId) {
        if (dst.type === TileType.Throne) {
            dst.army += moving;
        } else {
            dst.army += moving;
            dst.ownerId = playerId;
        }
    } else {
        if (moving > dst.army) {
            dst.army = moving - dst.army;
            if (dst.type === TileType.Throne) {
                playerDefeatedBy(state, dst.ownerId!, playerId);
            } else {
                dst.ownerId = playerId;
            }
        } else {
            dst.army -= moving;
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
            const tile = getTileUnsafe(state, y, x);
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
                const t = getTileUnsafe(state, y, x);
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

    // 保证即使外部只调用 updateGameState 也能同步胜负状态
    autoJudge(state);
}

export function autoJudge(state: GameState) {
    // —— 自动判负：如果玩家land和army都为0，直接判为Defeated ——
    for (const player of Object.values(state.players)) {
        if (player.status === PlayerStatus.Playing && player.land === 0 && player.army === 0) {
            player.status = PlayerStatus.Defeated;
        }
    }
    // —— 自动判负队伍+全局胜负判定：同tick内同步 ——
    let aliveTeamsCount = 0;
    for (const team of Object.values(state.teams)) {
        const allDefeated = team.memberIds.every(pid => state.players[pid]?.status !== PlayerStatus.Playing);
        if (allDefeated) {
            team.status = PlayerStatus.Defeated;
        } else {
            team.status = PlayerStatus.Playing;
            aliveTeamsCount++;
        }
    }
    const totalTeams = Object.keys(state.teams).length;
    if (totalTeams > 1 && aliveTeamsCount <= 1) {
        state.status = GameStatus.Ended;
    } else if (aliveTeamsCount === 0) {
        // 所有队伍都被淘汰
        state.status = GameStatus.Ended;
    } else {
        state.status = GameStatus.Playing;
    }
}

/** 判断某格与玩家地块是否相邻，用于战争迷雾 */
export function isAdjacentToPlayer(state: GameState, playerId: PlayerId, c: Coordinates): boolean {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = c.x + dx, y = c.y + dy;
            if (x >= 0 && x < state.map.width && y >= 0 && y < state.map.height) {
                if (getTileUnsafe(state, y, x).ownerId === playerId) return true;
            }
        }
    }
    return false;
}
