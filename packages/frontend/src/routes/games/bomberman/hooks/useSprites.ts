import { Assets, Rectangle, Texture } from "pixi.js";
import { createSignal, onMount } from "solid-js";
import type { FrameDef, PlayerFrames } from "../sprites/spritesheet";
import {
  ALL_PLAYER_FRAMES,
  BOMB_FRAMES,
  EXPLOSION_ALL,
  FLOOR_1,
  FLOOR_2,
  HARD_WALL,
  ITEM_FRAMES,
  SOFT_WALL,
} from "../sprites/spritesheet";

// ─── Types ───

export interface PlayerTextures {
  idleDown: Texture;
  walkDown: Texture[];
  idleRight: Texture;
  walkRight: Texture[];
  idleUp: Texture;
  walkUp: Texture[];
  walkLeft: Texture[]; // mirrored for right-facing
  idleLeft: Texture;
}

export interface BombermanSpritesheet {
  floors: [Texture, Texture];
  walls: { hard: Texture; soft: Texture };
  bombs: Texture[]; // 6 frames
  explosions: Texture[];
  players: PlayerTextures[]; // 4 players
  items: Record<string, Texture>;
}

// ─── Texture helpers ───

function createTexture(source: Texture, def: FrameDef): Texture {
  return new Texture({
    source: source.source,
    frame: new Rectangle(def.x, def.y, def.w, def.h),
  });
}

function createPlayerTextures(source: Texture, pf: PlayerFrames): PlayerTextures {
  return {
    idleDown: createTexture(source, pf.idleDown),
    walkDown: pf.walkDown.map((f) => createTexture(source, f)),
    idleRight: createTexture(source, pf.idleRight),
    walkRight: pf.walkRight.map((f) => createTexture(source, f)),
    idleUp: createTexture(source, pf.idleUp),
    walkUp: pf.walkUp.map((f) => createTexture(source, f)),
    walkLeft: pf.walkLeft.map((f) => createTexture(source, f)),
    idleLeft: createTexture(source, pf.idleLeft),
  };
}

// ─── Singleton loader ───

let cachedPromise: Promise<BombermanSpritesheet> | null = null;

function loadSpritesheet(): Promise<BombermanSpritesheet> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = Assets.load<Texture>("/sprites/bomberman.png").then((tex: Texture) => {
    tex.source.scaleMode = "nearest";

    return {
      floors: [createTexture(tex, FLOOR_1), createTexture(tex, FLOOR_2)],
      walls: {
        hard: createTexture(tex, HARD_WALL),
        soft: createTexture(tex, SOFT_WALL),
      },
      bombs: BOMB_FRAMES.map((f) => createTexture(tex, f)),
      explosions: EXPLOSION_ALL.map((f) => createTexture(tex, f)),
      players: ALL_PLAYER_FRAMES.map((pf) => createPlayerTextures(tex, pf)),
      items: Object.fromEntries(Object.entries(ITEM_FRAMES).map(([k, v]) => [k, createTexture(tex, v)])),
    };
  });

  return cachedPromise;
}

// ─── Hook ───

export function useSprites() {
  const [sprites, setSprites] = createSignal<BombermanSpritesheet | null>(null);

  onMount(async () => {
    const result = await loadSpritesheet();
    setSprites(result);
  });

  return sprites;
}
