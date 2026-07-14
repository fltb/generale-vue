import { Assets, Rectangle, Texture } from "pixi.js";
import { createSignal, onMount } from "solid-js";
import type { FrameDef } from "../sprites/spritesheet";
import {
  BOMB_ACTIVE,
  BOMB_IDLE,
  EXPLOSION_FRAMES,
  FLOOR_1,
  FLOOR_2,
  HARD_WALL,
  ITEM_FRAMES,
  PLAYER_DIR_COLS,
  PLAYER_ROWS,
  SOFT_WALL,
} from "../sprites/spritesheet";

// ─── Types ───

export interface PlayerSpriteSet {
  down: Texture[];
  left: Texture[];
  up: Texture[];
}

export interface BombermanSpritesheet {
  floors: [Texture, Texture];
  walls: { hard: Texture; soft: Texture };
  bombs: [Texture, Texture]; // [idle, active]
  explosions: Texture[];
  players: PlayerSpriteSet[];
  items: Record<string, Texture>;
}

// ─── Texture creation helpers ───

function createTexture(source: Texture, def: FrameDef): Texture {
  return new Texture({
    source: source.source,
    frame: new Rectangle(def.x, def.y, def.w, def.h),
  });
}

function createPlayerSet(source: Texture, row: number): PlayerSpriteSet {
  const colTex = (col: number) =>
    createTexture(source, { x: col * 16, y: row * 16, w: 16, h: 16 });
  return {
    down: PLAYER_DIR_COLS.down.frames.map(colTex),
    left: PLAYER_DIR_COLS.left.frames.map(colTex),
    up: PLAYER_DIR_COLS.up.frames.map(colTex),
  };
}

// ─── Singleton loading (cached across hook calls) ───

let cachedPromise: Promise<BombermanSpritesheet> | null = null;

function loadSpritesheet(): Promise<BombermanSpritesheet> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = Assets.load<Texture>("/sprites/bomberman.png").then((tex: Texture) => {
    // Enable nearest-neighbour scaling for crisp pixel art
    tex.source.scaleMode = "nearest";

    const floors: [Texture, Texture] = [
      createTexture(tex, FLOOR_1),
      createTexture(tex, FLOOR_2),
    ];

    const walls = {
      hard: createTexture(tex, HARD_WALL),
      soft: createTexture(tex, SOFT_WALL),
    };

    const bombs: [Texture, Texture] = [
      createTexture(tex, BOMB_IDLE),
      createTexture(tex, BOMB_ACTIVE),
    ];

    const explosions = EXPLOSION_FRAMES.map((f) => createTexture(tex, f));

    const players = PLAYER_ROWS.map((row) => createPlayerSet(tex, row));

    const items: Record<string, Texture> = {};
    for (const [key, frameDef] of Object.entries(ITEM_FRAMES)) {
      items[key] = createTexture(tex, frameDef);
    }

    return { floors, walls, bombs, explosions, players, items };
  });

  return cachedPromise;
}

// ─── Hook ───

/**
 * Loads the bomberman spritesheet and returns a reactive signal.
 * Caches the result globally so multiple consumers share a single load.
 */
export function useSprites() {
  const [sprites, setSprites] = createSignal<BombermanSpritesheet | null>(null);

  onMount(async () => {
    const result = await loadSpritesheet();
    setSprites(result);
  });

  return sprites;
}
