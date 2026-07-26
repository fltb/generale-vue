import { PlayerColor, PreGameMapType, type PreGamePlayerInfo, PreGamePlayerReadyState, PreGamePlayerStatus, TileType } from "@generale/types";
import { describe, expect, it } from "vitest";
import { generateMap } from "./map-gen";

describe("Map Generator", () => {
  it("should generate a valid map for 2 players", async () => {
    const players: PreGamePlayerInfo[] = [
      {
        id: "player1",
        name: "Player 1",
        teamId: "team1",
        isHost: true,
        ready: PreGamePlayerReadyState.Ready,
        tileColor: PlayerColor.Red,
        status: PreGamePlayerStatus.Lobby,
      },
      {
        id: "player2",
        name: "Player 2",
        teamId: "team2",
        isHost: false,
        ready: PreGamePlayerReadyState.Ready,
        tileColor: PlayerColor.Red,
        status: PreGamePlayerStatus.Lobby,
      },
    ];
    const mapSetting = {
      type: PreGameMapType.Random as const,
      width: 10,
      height: 10,
      tileFrequency: {
        [TileType.Plain]: 0.5,
        [TileType.Mountain]: 0.2,
        [TileType.Swamp]: 0.1,
        [TileType.Barracks]: 0.2,
      },
    };
    const map = await generateMap(mapSetting, players);
    expect(map.width).toBe(10);
    expect(map.height).toBe(10);
    // 检查王座数量
    let throneCount = 0;
    let playerTiles = 0;
    const tileStats: Record<string, number> = {};
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y]?.[x]!;
        tileStats[tile.type] = (tileStats[tile.type] || 0) + 1;
        if (tile.type === TileType.Throne) throneCount++;
        if (tile.ownerId) playerTiles++;
      }
    }
    expect(throneCount).toBe(players.length);
    expect(playerTiles).toBeGreaterThanOrEqual(players.length);
    // 地图尺寸
    expect(map.width).toBe(mapSetting.width);
    expect(map.height).toBe(mapSetting.height);
  });

  it("should generate a valid map for 4 players with correct distribution", async () => {
    const players: PreGamePlayerInfo[] = [
      {
        id: "player1",
        name: "Player 1",
        teamId: "team1",
        isHost: true,
        ready: PreGamePlayerReadyState.Ready,
        tileColor: PlayerColor.Red,
        status: PreGamePlayerStatus.Lobby,
      },
      {
        id: "player2",
        name: "Player 2",
        teamId: "team2",
        isHost: false,
        ready: PreGamePlayerReadyState.Ready,
        tileColor: PlayerColor.Red,
        status: PreGamePlayerStatus.Lobby,
      },
      {
        id: "player3",
        name: "Player 3",
        teamId: "team3",
        isHost: false,
        ready: PreGamePlayerReadyState.Ready,
        tileColor: PlayerColor.Red,
        status: PreGamePlayerStatus.Lobby,
      },
      {
        id: "player4",
        name: "Player 4",
        teamId: "team4",
        isHost: false,
        ready: PreGamePlayerReadyState.Ready,
        tileColor: PlayerColor.Red,
        status: PreGamePlayerStatus.Lobby,
      },
    ];
    const mapSetting = {
      type: PreGameMapType.Random as const,
      width: 12,
      height: 12,
      tileFrequency: {
        [TileType.Plain]: 0.5,
        [TileType.Mountain]: 0.2,
        [TileType.Swamp]: 0.1,
        [TileType.Barracks]: 0.2,
      },
    };
    const map = await generateMap(mapSetting, players);
    expect(map.width).toBe(12);
    expect(map.height).toBe(12);
    // 检查王座数量
    let throneCount = 0;
    let playerTiles = 0;
    const playerStats: Record<string, number> = {};
    const tileStats: Record<string, number> = {};
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y]?.[x]!;
        tileStats[tile.type] = (tileStats[tile.type] || 0) + 1;
        if (tile.type === TileType.Throne) throneCount++;
        if (tile.ownerId) {
          playerTiles++;
          playerStats[tile.ownerId] = (playerStats[tile.ownerId] || 0) + 1;
        }
      }
    }
    expect(throneCount).toBe(players.length);
    expect(playerTiles).toBeGreaterThanOrEqual(players.length);
    // 每个玩家至少有一块地
    expect(Object.keys(playerStats).length).toBe(players.length);
    // 地图尺寸
    expect(map.width).toBe(mapSetting.width);
    expect(map.height).toBe(mapSetting.height);

    // 可选：输出地图统计信息
    // console.log('Tile distribution:', tileStats);
    // console.log('Player territories:', playerStats);
  });

});
