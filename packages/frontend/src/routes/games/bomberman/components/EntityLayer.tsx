import type { BombermanPlayer, Bomb, Explosion, Item } from "@generale/types";
import type { Graphics as PIXIGraphics, Texture } from "pixi.js";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { Container, Graphics as PGraphics, Sprite } from "solid-pixi";
import { useSprites, type PlayerTextures } from "../hooks/useSprites";
import { TILE_SIZE } from "../sprites/spritesheet";

// ─── Fallback colors for items without sprites ───
const ITEM_DOT_COLORS: Record<string, number> = {
  FIRE_UP: 0xff8800,
  SPEED_UP: 0x0088cc,
  PUNCH: 0xcc0000,
  REMOTE: 0x8800cc,
  SPIRIT: 0x44cc44,
};

interface EntityLayerProps {
  players: BombermanPlayer[];
  bombs: Bomb[];
  explosions: Explosion[];
  items: Item[];
}

/** Pick idle or walk frame based on facing direction and animation tick. */
function getPlayerTexture(pt: PlayerTextures, facing: string, frame: number): Texture {
  const key = facing === "right" ? "left" : facing;
  if (key === "left") return pt.walkLeft[frame % pt.walkLeft.length];
  if (key === "up") return frame % 2 === 0 ? pt.idleUp : pt.walkUp[frame % pt.walkUp.length];
  if (key === "down") return frame % 2 === 0 ? pt.idleDown : pt.walkDown[frame % pt.walkDown.length];
  return pt.idleDown;
}

export function EntityLayer(props: EntityLayerProps) {
  const s = useSprites();

  // ── Tick counter for animation ──
  const [tick, setTick] = createSignal(0);
  createEffect(() => {
    // Increment tick on every effect run to drive frame animation
    setTick((t) => (t + 1) % 1000);
  });

  // ── Items only with sprites ──
  const spritedItems = createMemo(() => {
    const sheet = s();
    if (!sheet) return [];
    return props.items.filter((item) => sheet.items[item.type]);
  });

  return (
    <Show when={s()}>
      {(sprites) => (
        <Container sortableChildren>
          {/* ── Items (z=1) ── */}
          <For each={spritedItems()}>
            {(item) => (
              <Sprite
                texture={sprites().items[item.type]}
                x={item.x * TILE_SIZE + 2}
                y={item.y * TILE_SIZE + 2}
                scale={{ x: (TILE_SIZE / 16) * 0.6, y: (TILE_SIZE / 16) * 0.6 }}
                zIndex={1}
              />
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
              const colorIdx = idx() % sprites().players.length;
              const pt = sprites().players[colorIdx];
              const tex = getPlayerTexture(pt, player.facing, tick());
              const flipX = player.facing === "right" ? -1 : 1;
              return (
                <Sprite
                  texture={tex}
                  x={player.x * TILE_SIZE + TILE_SIZE / 2}
                  y={player.y * TILE_SIZE + TILE_SIZE / 2}
                  anchor={{ x: 0.5, y: 0.5 }}
                  scale={{ x: (TILE_SIZE / 16) * 0.9 * flipX, y: (TILE_SIZE / 16) * 0.9 }}
                  zIndex={10}
                />
              );
            }}
          </For>

          {/* ── Non-sprited item dots (z=0, behind items with sprites) ── */}
          <NonSpritedItems allItems={props.items} spritesheet={sprites()} />
        </Container>
      )}
    </Show>
  );
}

// ─── Non-sprited items rendered as colored dots ───

interface NonSpritedItemsProps {
  allItems: Item[];
  spritesheet: { items: Record<string, Texture> };
}

function NonSpritedItems(props: NonSpritedItemsProps) {
  const dotItems = () => props.allItems.filter((item) => !props.spritesheet.items[item.type]);

  return (
    <For each={dotItems()}>
      {(item) => {
        const color = ITEM_DOT_COLORS[item.type] ?? 0x888888;
        return <ItemDot x={item.x} y={item.y} color={color} />;
      }}
    </For>
  );
}

function ItemDot(props: { x: number; y: number; color: number }) {
  const [g, setG] = createSignal<PIXIGraphics | undefined>(undefined);

  createEffect(() => {
    const graphics = g();
    if (!graphics) return;
    graphics.clear();
    graphics.circle(0, 0, TILE_SIZE * 0.15).fill({ color: props.color });
    graphics.circle(0, 0, TILE_SIZE * 0.15).stroke({ color: 0x000000, width: 1 });
  });

  return (
    <PGraphics
      ref={(inst) => {
        setG(inst);
        return () => setG(undefined);
      }}
      x={props.x * TILE_SIZE + TILE_SIZE / 2}
      y={props.y * TILE_SIZE + TILE_SIZE / 2}
      zIndex={0}
    />
  );
}
