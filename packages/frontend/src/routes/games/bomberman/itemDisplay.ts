import type { ItemType } from "@generale/types";

export interface ItemDisplayInfo {
  /** Short badge text (HUD/tutorial), latin chars, untranslated */
  label: string;
  /** EventFeed icon */
  emoji: string;
  /** Default accent color (css hex) */
  accent: string;
  /** Colorblind-safe accent color (Okabe-Ito palette, css hex) */
  accentSafe: string;
  nameKey: `bomberman.itemNames.${ItemType}`;
  descKey: string;
  kind: "passive" | "active";
}

export const ITEM_ORDER: readonly ItemType[] = [
  "BOMB_UP",
  "FIRE_UP",
  "SPEED_UP",
  "KICK",
  "GLOVE",
  "PUNCH",
  "REMOTE",
  "PIERCE",
  "SPIRIT",
] as const;

export const ITEM_DISPLAY = {
  BOMB_UP: {
    label: "B+",
    emoji: "\u{1F4A3}",
    accent: "#f44",
    accentSafe: "#E69F00",
    nameKey: "bomberman.itemNames.BOMB_UP",
    descKey: "bomberman.tutorial.bombUp",
    kind: "passive",
  },
  FIRE_UP: {
    label: "F+",
    emoji: "\u{1F525}",
    accent: "#f80",
    accentSafe: "#D55E00",
    nameKey: "bomberman.itemNames.FIRE_UP",
    descKey: "bomberman.tutorial.fireUp",
    kind: "passive",
  },
  SPEED_UP: {
    label: "S+",
    emoji: "\u26A1",
    accent: "#4af",
    accentSafe: "#F0E442",
    nameKey: "bomberman.itemNames.SPEED_UP",
    descKey: "bomberman.tutorial.speedUp",
    kind: "passive",
  },
  KICK: {
    label: "Kick",
    emoji: "\u{1F43E}",
    accent: "#a6f",
    accentSafe: "#0072B2",
    nameKey: "bomberman.itemNames.KICK",
    descKey: "bomberman.tutorial.kick",
    kind: "passive",
  },
  GLOVE: {
    label: "Glove",
    emoji: "\u{1F9E4}",
    accent: "#ccc",
    accentSafe: "#CC79A7",
    nameKey: "bomberman.itemNames.GLOVE",
    descKey: "bomberman.tutorial.glove",
    kind: "active",
  },
  PUNCH: {
    label: "Punch",
    emoji: "\u{1F44A}",
    accent: "#fa0",
    accentSafe: "#56B4E9",
    nameKey: "bomberman.itemNames.PUNCH",
    descKey: "bomberman.tutorial.punch",
    kind: "active",
  },
  REMOTE: {
    label: "Rmte",
    emoji: "\u{1F4E1}",
    accent: "#0ff",
    accentSafe: "#009E73",
    nameKey: "bomberman.itemNames.REMOTE",
    descKey: "bomberman.tutorial.remote",
    kind: "active",
  },
  PIERCE: {
    label: "Prce",
    emoji: "\u{1F5E1}",
    accent: "#fff",
    accentSafe: "#FFFFFF",
    nameKey: "bomberman.itemNames.PIERCE",
    descKey: "bomberman.tutorial.pierce",
    kind: "passive",
  },
  SPIRIT: {
    label: "Spirit",
    emoji: "\u{1F47B}",
    accent: "#f0f",
    accentSafe: "#999999",
    nameKey: "bomberman.itemNames.SPIRIT",
    descKey: "bomberman.tutorial.spirit",
    kind: "passive",
  },
} as const satisfies Record<ItemType, ItemDisplayInfo>;

/** css hex → pixi numeric color. colorVision comes from BombermanUserSettings.colorVision */
export function itemAccentNumber(type: ItemType, colorVision: "default" | "safe"): number {
  const raw = itemAccentCss(type, colorVision).slice(1);
  const hex = raw.length === 3 ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}` : raw;
  return Number.parseInt(hex, 16);
}

export function itemAccentCss(type: ItemType, colorVision: "default" | "safe"): string {
  const info = ITEM_DISPLAY[type];
  return colorVision === "safe" ? info.accentSafe : info.accent;
}
