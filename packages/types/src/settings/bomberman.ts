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

export interface BombermanGamepadBindings {
  placeBomb: number;
  action: number;
  detonate: number;
  menu: number;
}

export const BOMBERMAN_GAMEPAD_BINDINGS_DEFAULTS: BombermanGamepadBindings = {
  placeBomb: 0,
  action: 2,
  detonate: 1,
  menu: 9,
};

export interface BombermanGamepadSettings {
  enabled: boolean;
  index: number;
  deadzone: number;
  bindings: BombermanGamepadBindings;
}

export interface BombermanUserSettings {
  keybindings: BombermanKeybindings;
  soundVolume: number;
  gamepad: BombermanGamepadSettings;
  highContrast: boolean;
  colorVision: "default" | "safe";
  touchLayout: "compact" | "spread";
  haptics: boolean;
  showInputOverlay: boolean;
  selectedSkinId: string;
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
  gamepad: {
    enabled: true,
    index: 0,
    deadzone: 0.55,
    bindings: BOMBERMAN_GAMEPAD_BINDINGS_DEFAULTS,
  },
  highContrast: false,
  colorVision: "default",
  touchLayout: "compact",
  haptics: false,
  showInputOverlay: false,
  selectedSkinId: "classic-blue",
};

export const bombermanSettingsSchema = jsonGameSettingsSchema<BombermanUserSettings>(
  "bomberman",
  BOMBERMAN_SETTINGS_DEFAULTS,
  [
    "keybindings",
    "soundVolume",
    "gamepad",
    "highContrast",
    "colorVision",
    "touchLayout",
    "haptics",
    "showInputOverlay",
    "selectedSkinId",
  ],
);
