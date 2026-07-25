/**
 * Bomberman skin and theme manifests — read-only registries for appearance validation.
 * These are shared between frontend and backend; the engine only carries opaque string IDs.
 */

// ─── Skin Manifest ────────────────────────────────────────────────────────────

export interface BombermanSkinEntry {
  id: string;
  name: string;
  frameIndex: number;
}

export const BOMBERMAN_SKIN_MANIFEST: readonly BombermanSkinEntry[] = [
  { id: "classic-blue", name: "Classic Blue", frameIndex: 0 },
  { id: "classic-green", name: "Classic Green", frameIndex: 1 },
  { id: "classic-red", name: "Classic Red", frameIndex: 2 },
  { id: "classic-purple", name: "Classic Purple", frameIndex: 3 },
];

export type BombermanSkinId = (typeof BOMBERMAN_SKIN_MANIFEST)[number]["id"];

/** All valid skin IDs as a Record for runtime lookup. */
export const VALID_BOMBERMAN_SKIN_IDS: Record<string, true> = Object.fromEntries(
  BOMBERMAN_SKIN_MANIFEST.map((s) => [s.id, true] as const),
) as Record<string, true>;

// ─── Theme Manifest ───────────────────────────────────────────────────────────

export interface BombermanThemeEntry {
  id: string;
  background: number;
  wallTint: number;
  explosionTint: number;
}

export const BOMBERMAN_THEME_MANIFEST: readonly BombermanThemeEntry[] = [
  { id: "classic", background: 0x111827, wallTint: 0xffffff, explosionTint: 0xffffff },
  { id: "night", background: 0x050816, wallTint: 0x8090c0, explosionTint: 0x66ccff },
  { id: "high-contrast", background: 0x000000, wallTint: 0xffffff, explosionTint: 0xff00ff },
];

export type BombermanThemeId = (typeof BOMBERMAN_THEME_MANIFEST)[number]["id"];

export const VALID_BOMBERMAN_THEME_IDS: Record<string, true> = Object.fromEntries(
  BOMBERMAN_THEME_MANIFEST.map((t) => [t.id, true] as const),
) as Record<string, true>;

// ─── Preset Map Definitions ───────────────────────────────────────────────────

/**
 * Preset map generation parameters.
 * Call generateBombermanMap({ width, height, themeId, softWallDensity, random: new Mulberry32(seed) })
 * from @generale/bomberman-engine to materialize the actual tiles.
 */
export const BOMBERMAN_PRESET_DEFINITIONS: Record<
  "classic" | "sparse" | "dense",
  { width: number; height: number; seed: number; density: number; themeId: string }
> = {
  classic: { width: 15, height: 13, seed: 1001, density: 0.55, themeId: "classic" },
  sparse: { width: 15, height: 13, seed: 1002, density: 0.35, themeId: "night" },
  dense: { width: 15, height: 13, seed: 1003, density: 0.7, themeId: "classic" },
};
