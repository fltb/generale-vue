import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import { useGameSettings } from "~/hooks/useGameSettings";
import {
  bombermanSettingsSchema,
  BOMBERMAN_SETTINGS_DEFAULTS,
  type BombermanKeybindings,
  type BombermanGamepadBindings,
} from "@generale/types";
import { useT } from "~/i18n/useT";
import { formatKey } from "../utils";
import { Button, Select } from "~/ui";

const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "Back",
  9: "Start",
  10: "Left Stick",
  11: "Right Stick",
  12: "DPad Up",
  13: "DPad Down",
  14: "DPad Left",
  15: "DPad Right",
  16: "Home",
  17: "Capture",
};

function formatGamepadButton(index: number): string {
  return GAMEPAD_BUTTON_LABELS[index] ?? `Btn ${index}`;
}

export const KeybindingSettings: Component = () => {
  const { t } = useT();
  const { settings, update } = useGameSettings(bombermanSettingsSchema);
  const ACTION_LABELS: Record<keyof BombermanKeybindings, string> = {
    up: `${t("bomberman.move")} Up`,
    down: `${t("bomberman.move")} Down`,
    left: `${t("bomberman.move")} Left`,
    right: `${t("bomberman.move")} Right`,
    placeBomb: t("bomberman.placeBomb"),
    action: t("bomberman.action"),
    detonate: t("bomberman.detonate"),
    surrender: t("bomberman.surrender"),
  };
  const GAMEPAD_LABELS: Record<keyof BombermanGamepadBindings, string> = {
    placeBomb: t("bomberman.placeBomb"),
    action: t("bomberman.action"),
    detonate: t("bomberman.detonate"),
    menu: t("bomberman.menu"),
  };
  const [listeningKey, setListeningKey] = createSignal<keyof BombermanKeybindings | null>(null);

  // Window-level keydown capture while listening for a rebind
  createEffect(() => {
    const action = listeningKey();
    if (!action) return;

    function handler(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels rebinding (unless rebinding surrender itself)
      if (e.key === "Escape" && action !== "surrender") {
        setListeningKey(null);
        return;
      }

      const key = e.key === "Spacebar" ? " " : e.key;
      const keyName = action as keyof BombermanKeybindings;
      const newKeybindings = {
        ...settings().keybindings,
        [keyName]: key,
      } satisfies BombermanKeybindings;
      update({ keybindings: newKeybindings });
      setListeningKey(null);
    }

    window.addEventListener("keydown", handler, { capture: true });
    onCleanup(() => window.removeEventListener("keydown", handler, { capture: true }));
  });

  function resetToDefaults() {
    update({ keybindings: BOMBERMAN_SETTINGS_DEFAULTS.keybindings });
  }

  return (
    <div class="space-y-6">
      {/* ── Keyboard Keybindings ── */}
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold">{t("bomberman.keybindings")}</h3>
          <Button size="sm" variant="ghost" onClick={resetToDefaults}>
            {t("bomberman.resetToDefaults")}
          </Button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <For each={Object.keys(ACTION_LABELS) as (keyof BombermanKeybindings)[]}>
            {(action) => (
              <div class="flex items-center justify-between p-2 bg-base-200 rounded">
                <span class="text-sm">{ACTION_LABELS[action]}</span>
                <Show
                  when={listeningKey() === action}
                  fallback={
                    <Button size="sm" outline class="font-mono min-w-[60px]" onClick={() => setListeningKey(action)}>
                      {formatKey(settings().keybindings[action])}
                    </Button>
                  }
                >
                  <Button size="sm" variant="warning" disabled class="font-mono min-w-[60px] animate-pulse">
                    {t("bomberman.pressKey")}
                  </Button>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* ── Gamepad Settings ── */}
      <div class="space-y-3 border-t border-base-300 pt-4">
        <h3 class="text-lg font-bold">{t("bomberman.gamepad")}</h3>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.gamepadEnabled")}</span>
          <input
            type="checkbox"
            class="toggle"
            checked={settings().gamepad.enabled}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLInputElement;
              update({ gamepad: { ...settings().gamepad, enabled: target.checked } });
            }}
          />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.gamepadIndex")}</span>
          <Select
            value={String(settings().gamepad.index)}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLSelectElement;
              update({ gamepad: { ...settings().gamepad, index: Number(target.value) } });
            }}
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </Select>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.gamepadDeadzone")}</span>
          <div class="flex items-center gap-2">
            <input
              type="range"
              class="range range-sm"
              value={settings().gamepad.deadzone}
              min={0.1}
              max={0.9}
              step={0.05}
              onInput={(e: Event) => {
                const target = e.currentTarget as HTMLInputElement;
                update({ gamepad: { ...settings().gamepad, deadzone: Number(target.value) } });
              }}
            />
            <span class="text-xs font-mono w-10 text-right">{settings().gamepad.deadzone.toFixed(2)}</span>
          </div>
        </div>

        <div class="space-y-2">
          <span class="text-sm font-semibold">{t("bomberman.gamepadBindings")}</span>
          {(["placeBomb", "action", "detonate", "menu"] as const).map((action: keyof BombermanGamepadBindings) => (
            <div class="flex items-center justify-between p-2 bg-base-200 rounded">
              <span class="text-sm">{GAMEPAD_LABELS[action]}</span>
              <Button
                size="sm"
                outline
                class="font-mono min-w-[70px]"
                onClick={() => {
                  // Cycle through buttons 0-17 for simple remapping
                  const bindings = settings().gamepad.bindings;
                  const current = bindings[action];
                  const next = (current + 1) % 18;
                  update({
                    gamepad: {
                      ...settings().gamepad,
                      bindings: { ...bindings, [action]: next },
                    },
                  });
                }}
              >
                {formatGamepadButton(settings().gamepad.bindings[action])}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Appearance Settings ── */}
      <div class="space-y-3 border-t border-base-300 pt-4">
        <h3 class="text-lg font-bold">{t("bomberman.appearance")}</h3>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.highContrast")}</span>
          <input
            type="checkbox"
            class="toggle"
            checked={settings().highContrast}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLInputElement;
              update({ highContrast: target.checked });
            }}
          />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.colorVision")}</span>
          <Select
            value={settings().colorVision}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLSelectElement;
              update({ colorVision: target.value as "default" | "safe" });
            }}
          >
            <option value="default">{t("bomberman.colorVisionDefault")}</option>
            <option value="safe">{t("bomberman.colorVisionSafe")}</option>
          </Select>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.selectedSkin")}</span>
          <Select
            value={settings().selectedSkinId}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLSelectElement;
              update({ selectedSkinId: target.value });
            }}
          >
            <option value="classic-blue">{t("bomberman.skinClassicBlue")}</option>
            <option value="classic-green">{t("bomberman.skinClassicGreen")}</option>
            <option value="classic-red">{t("bomberman.skinClassicRed")}</option>
            <option value="classic-purple">{t("bomberman.skinClassicPurple")}</option>
          </Select>
        </div>
      </div>

      {/* ── Controls & Feedback ── */}
      <div class="space-y-3 border-t border-base-300 pt-4">
        <h3 class="text-lg font-bold">{t("bomberman.controlsFeedback")}</h3>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.touchLayout")}</span>
          <Select
            value={settings().touchLayout}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLSelectElement;
              update({ touchLayout: target.value as "compact" | "spread" });
            }}
          >
            <option value="compact">{t("bomberman.touchLayoutCompact")}</option>
            <option value="spread">{t("bomberman.touchLayoutSpread")}</option>
          </Select>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.haptics")}</span>
          <input
            type="checkbox"
            class="toggle"
            checked={settings().haptics}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLInputElement;
              update({ haptics: target.checked });
            }}
          />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.soundVolume")}</span>
          <div class="flex items-center gap-2">
            <input
              type="range"
              class="range range-sm"
              value={settings().soundVolume}
              min={0}
              max={1}
              step={0.1}
              onInput={(e: Event) => {
                const target = e.currentTarget as HTMLInputElement;
                update({ soundVolume: Number(target.value) });
              }}
            />
            <span class="text-xs font-mono w-10 text-right">{(settings().soundVolume * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">{t("bomberman.showInputOverlay")}</span>
          <input
            type="checkbox"
            class="toggle"
            checked={settings().showInputOverlay}
            onChange={(e: Event) => {
              const target = e.currentTarget as HTMLInputElement;
              update({ showInputOverlay: target.checked });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default KeybindingSettings;
