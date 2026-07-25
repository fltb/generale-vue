import { describe, it, vi } from "vitest";
import { BombermanService } from "./games/bomberman/service/BombermanService";
import { defaultBombermanConfig } from "./games/bomberman/settings";
import { mapService } from "./services/mapService";

function mc() {
  return {
    send: () => {}, close: () => {},
    onOpen: () => {}, onDisconnect: () => {}, onReconnect: () => {},
    onClientMessage: () => {}, onClose: () => {},
    getConnectionId: () => "c", getContext: () => ({}),
    domain: "test", ready: true,
  } as any;
}

describe("debug9", () => {
  it("mock mapService to return valid workshop map", async () => {
    const cfg = defaultBombermanConfig();
    cfg.mapSource = { type: "workshop", id: "test-map" } as any;
    
    // Build a valid map definition
    const w = 15, h = 13;
    const tiles = Array.from({length: h}, () => Array.from({length: w}, () => 0));
    // Make all passable
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        tiles[y][x] = 1;
      }
    }
    
    vi.spyOn(mapService, "loadMapData").mockResolvedValue({
      schemaVersion: 1,
      width: w, height: h,
      themeId: "classic",
      tiles,
      spawns: [{x:7,y:6},{x:7,y:6},{x:7,y:6},{x:7,y:6}],
      fixedItems: [],
    });
    
    const service = new BombermanService("d10", "D", cfg, "h", "H");
    const room = (service as any).room;
    room.addPlayer({ id: "h", name: "H" }, mc());
    room.addPlayer({ id: "p", name: "P" }, mc());
    
    await service.startGame();
    console.log("game:", (service as any).game?.constructor?.name);
  });
});
