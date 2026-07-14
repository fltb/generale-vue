import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import { useGameSettings } from "~/hooks/useGameSettings";
import { bombermanSettingsSchema, BOMBERMAN_SETTINGS_DEFAULTS, type BombermanKeybindings } from "@generale/types";
import { useT } from "~/i18n/useT";
import { formatKey } from "../utils";
import { Button } from "~/ui";

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
  );
};

export default KeybindingSettings;
