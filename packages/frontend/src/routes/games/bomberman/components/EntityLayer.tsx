import type { BombermanPlayer, Bomb, Explosion, Item } from "@generale/types";
import type { Graphics as PIXIGraphics, Texture } from "pixi.js";
import { For, Show, createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { Container, Graphics as PGraphics, Sprite } from "solid-pixi";
import { useSprites, type PlayerTextures } from "../hooks/useSprites";
import { TILE_SIZE, SKIN_SPRITE_INDEX } from "../sprites/spritesheet";
import { itemAccentNumber } from "../itemDisplay";
import { useInterpolatedBombermanPosition } from "../hooks/useInterpolatedBombermanPosition";

interface EntityLayerProps {
  players: BombermanPlayer[];
  bombs: Bomb[];
  explosions: Explosion[];
  items: Item[];
  tickRate: number;
  reducedMotion?: boolean;
  highContrast?: boolean;
  colorVision?: "default" | "safe";
}

/** Pick idle or walk frame based on facing direction and animation tick. */
function getPlayerTexture(pt: PlayerTextures, facing: string, frame: number): Texture {
  const key = facing === "right" ? "left" : facing;
  if (key === "left") return pt.walkLeft[frame % pt.walkLeft.length];
  if (key === "up") return frame % 2 === 0 ? pt.idleUp : pt.walkUp[frame % pt.walkUp.length];
  if (key === "down") return frame % 2 === 0 ? pt.idleDown : pt.walkDown[frame % pt.walkDown.length];
  return pt.idleDown;
}

export function PlayerSprite(props: {
  player: BombermanPlayer;
  sprites: PlayerTextures[];
  bombTextures: Texture[];
  colorIdx: number;
  tick: Accessor<number>;
  tickRate: number;
  reducedMotion?: boolean;
}) {
  const target = () => ({
    x: props.player.x,
    y: props.player.y,
    speed: props.player.speed,
    tickRate: props.tickRate,
    alive: props.player.alive,
  });
  const { x, y, moving } = useInterpolatedBombermanPosition(target);

  const tex = () => {
    const pt = props.sprites[props.colorIdx];
    if (!moving()) {
      const key = props.player.facing === "right" ? "left" : props.player.facing;
      if (key === "up") return pt.idleUp;
      if (key === "down") return pt.idleDown;
      if (key === "left") return pt.idleLeft;
      return pt.idleDown;
    }
    return getPlayerTexture(pt, props.player.facing, props.tick());
  };

  const flipX = () => (props.player.facing === "right" ? -1 : 1);

  return (
    <Container sortableChildren zIndex={10}>
      <Sprite
        texture={tex()}
        x={x() * TILE_SIZE + TILE_SIZE / 2}
        y={y() * TILE_SIZE + TILE_SIZE / 2}
        anchor={{ x: 0.5, y: 0.5 }}
        scale={{
          x: (TILE_SIZE / 16) * 0.9 * flipX(),
          y: (TILE_SIZE / 16) * 0.9,
        }}
        zIndex={10}
      />
      <Show when={props.player.carriedBomb}>
        {(_bomb) => {
          const above = props.player.y >= 1;
          const bob = props.reducedMotion ? 0 : [0, 1.5, 3, 1.5][props.tick() % 4];
          const offsetY = above ? -TILE_SIZE * 0.6 : TILE_SIZE * 0.6;
          const indicatorY = y() * TILE_SIZE + TILE_SIZE / 2 + offsetY + bob;
          return (
            <>
              <PGraphics
                ref={(graphics: PIXIGraphics) => {
                  createEffect(() => {
                    if (!graphics) return;
                    graphics.clear();
                    graphics.lineStyle(2, 0xffffff, 0.9);
                    graphics.drawCircle(0, 0, TILE_SIZE * 0.28);
                  });
                }}
                x={x() * TILE_SIZE + TILE_SIZE / 2}
                y={indicatorY}
                zIndex={10.5}
              />
              <Sprite
                texture={props.bombTextures[0]}
                x={x() * TILE_SIZE + TILE_SIZE / 2}
                y={indicatorY}
                anchor={{ x: 0.5, y: 0.5 }}
                scale={{
                  x: (TILE_SIZE / 16) * 0.7,
                  y: (TILE_SIZE / 16) * 0.7,
                }}
                zIndex={11}
              />
            </>
          );
        }}
      </Show>
    </Container>
  );
}

export function EntityLayer(props: EntityLayerProps) {
  const s = useSprites();

  // ── Tick counter for walk animation frame cycling ──
  const [tick, setTick] = createSignal(0);
  const animTimer = setInterval(() => {
    setTick((t) => (t + 1) % 1000);
  }, 150);
  onCleanup(() => clearInterval(animTimer));

  // ── Pulse animation for item plates ──
  const pulse = () => (props.reducedMotion ? 1 : [1, 0.75, 0.5, 0.75][tick() % 4]);

  return (
    <Show when={s()}>
      {(sprites) => (
        <Container sortableChildren>
          {/* ── Items (z=1) with accent plates (z=0.8) ── */}
          <For each={props.items}>
            {(item) => (
              <Show when={sprites().items[item.type]}>
                {(_texture) => {
                  const accent = itemAccentNumber(item.type, props.colorVision ?? "default");
                  const itemScale = props.highContrast ? 1.1 : 1.0;
                  return (
                    <>
                      <ItemPlate
                        x={item.x}
                        y={item.y}
                        accent={accent}
                        highContrast={props.highContrast ?? false}
                        pulse={pulse()}
                      />
                      <Sprite
                        texture={sprites().items[item.type]}
                        x={item.x * TILE_SIZE + TILE_SIZE / 2}
                        y={item.y * TILE_SIZE + TILE_SIZE / 2}
                        anchor={{ x: 0.5, y: 0.5 }}
                        scale={{
                          x: (TILE_SIZE / 16) * itemScale,
                          y: (TILE_SIZE / 16) * itemScale,
                        }}
                        zIndex={1}
                      />
                    </>
                  );
                }}
              </Show>
            )}
          </For>

          {/* ── Bombs (z=2) ── */}
          <For each={props.bombs}>
            {(bomb) => {
              const frameIdx = Math.min(bomb.fuse - 1, sprites().bombs.length - 1);
              return (
                <Sprite
                  texture={sprites().bombs[Math.max(0, frameIdx)]}
                  x={bomb.x * TILE_SIZE + TILE_SIZE / 2}
                  y={bomb.y * TILE_SIZE + TILE_SIZE / 2}
                  anchor={{ x: 0.5, y: 0.5 }}
                  scale={{ x: (TILE_SIZE / 16) * 0.8, y: (TILE_SIZE / 16) * 0.8 }}
                  zIndex={2}
                />
              );
            }}
          </For>

          {/* ── Explosions (z=3) ── */}
          <For each={props.explosions}>
            {(exp) => {
              const frameIdx = Math.min(
                Math.max(0, Math.floor(((8 - exp.ttl) / 8) * sprites().explosions.length)),
                sprites().explosions.length - 1,
              );
              return (
                <Sprite
                  texture={sprites().explosions[frameIdx]}
                  x={exp.x * TILE_SIZE + TILE_SIZE / 2}
                  y={exp.y * TILE_SIZE + TILE_SIZE / 2}
                  anchor={{ x: 0.5, y: 0.5 }}
                  scale={{ x: TILE_SIZE / 16, y: TILE_SIZE / 16 }}
                  alpha={Math.max(0.3, exp.ttl / 8)}
                  zIndex={3}
                />
              );
            }}
          </For>

          {/* ── Players (z=10) ── */}
          <For each={props.players}>
            {(player, idx) => {
              if (!player.alive) return null;
              const colorIdx = SKIN_SPRITE_INDEX[player.skinId] ?? idx() % sprites().players.length;
              return (
                <PlayerSprite
                  player={player}
                  sprites={sprites().players}
                  bombTextures={sprites().bombs}
                  colorIdx={colorIdx}
                  tick={tick}
                  tickRate={props.tickRate}
                  reducedMotion={props.reducedMotion}
                />
              );
            }}
          </For>
        </Container>
      )}
    </Show>
  );
}

/** Accent plate beneath each item sprite (z=0.8, behind item z=1) */
function ItemPlate(props: { x: number; y: number; accent: number; highContrast: boolean; pulse: number }) {
  const [g, setG] = createSignal<PIXIGraphics | undefined>(undefined);

  createEffect(() => {
    const graphics = g();
    if (!graphics) return;
    graphics.clear();
    const bgAlpha = props.highContrast ? 1 : 0.85;
    graphics
      .roundRect(-TILE_SIZE * 0.42, -TILE_SIZE * 0.42, TILE_SIZE * 0.84, TILE_SIZE * 0.84, 4)
      .fill({ color: 0x0f0f1a, alpha: bgAlpha })
      .stroke({ color: props.accent, width: props.highContrast ? 3 : 2, alpha: props.pulse });
  });

  return (
    <PGraphics
      ref={(inst) => {
        setG(inst);
        return () => setG(undefined);
      }}
      x={props.x * TILE_SIZE + TILE_SIZE / 2}
      y={props.y * TILE_SIZE + TILE_SIZE / 2}
      zIndex={0.8}
    />
  );
}
