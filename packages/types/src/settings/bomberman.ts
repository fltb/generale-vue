import { jsonGameSettingsSchema } from "./game";

export interface BombermanKeybindings {
  up: string;
  down: string;
  left: string;
  right: string;
  placeBomb: string;
  action: string;
  detonate: string;
  surrender: string;
}

export interface BombermanUserSettings {
  keybindings: BombermanKeybindings;
  soundVolume: number;
}

export const BOMBERMAN_SETTINGS_DEFAULTS: BombermanUserSettings = {
  keybindings: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    placeBomb: " ",
    action: "q",
    detonate: "e",
    surrender: "Escape",
  },
  soundVolume: 1,
};

export const bombermanSettingsSchema = jsonGameSettingsSchema<BombermanUserSettings>(
  "bomberman",
  BOMBERMAN_SETTINGS_DEFAULTS,
  ["keybindings", "soundVolume"],
);
