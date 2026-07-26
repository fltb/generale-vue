import { For, Show } from "solid-js";
import type { Component } from "solid-js";
import { useT } from "~/i18n/useT";
import { Button, Modal } from "~/ui";
import { formatKey } from "../utils";
import { BOMBERMAN_SETTINGS_DEFAULTS } from "@generale/types";
import type { BombermanKeybindings } from "@generale/types";
import { ITEM_ORDER, ITEM_DISPLAY, itemAccentCss } from "../itemDisplay";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const BombermanTutorial: Component<Props> = (props) => {
  const { t } = useT();

  const defaults = BOMBERMAN_SETTINGS_DEFAULTS.keybindings;

  function keyStr(key: keyof BombermanKeybindings): string {
    return formatKey(defaults[key]);
  }

  return (
    <Show when={props.open}>
      <Modal boxClass="max-w-xl max-h-[80vh] overflow-y-auto">
        <div class="flex justify-end mb-2">
          <Button size="sm" variant="ghost" square onClick={props.onClose} aria-label={t("bomberman.close")}>
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>

        <h2 class="text-xl font-bold mb-4">{t("bomberman.tutorial")}</h2>

        {/* Movement & Controls */}
        <section class="mb-6">
          <h3 class="text-lg font-semibold mb-2">{t("bomberman.tutorial.movement")}</h3>
          <p class="text-sm text-base-content/80 mb-2">{t("bomberman.tutorial.movementDesc")}</p>
          <p class="text-sm mb-2">
            {t("bomberman.tutorial.movementKeys", {
              up: keyStr("up"),
              down: keyStr("down"),
              left: keyStr("left"),
              right: keyStr("right"),
              placeBomb: keyStr("placeBomb"),
              action: keyStr("action"),
              detonate: keyStr("detonate"),
              surrender: keyStr("surrender"),
            })}
          </p>
          <p class="text-xs text-base-content/60 italic">{t("bomberman.tutorial.keysConfigurable")}</p>
        </section>

        {/* Items */}
        <section>
          <h3 class="text-lg font-semibold mb-2">{t("bomberman.tutorial.items")}</h3>
          <p class="text-xs text-base-content/60 mb-2">{t("bomberman.tutorial.carryHint")}</p>

          {/* Passive items */}
          <div class="mb-3">
            <p class="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-2">
              {t("bomberman.tutorial.passive")}
            </p>
            <div class="space-y-1.5">
              <For each={ITEM_ORDER.filter((type) => ITEM_DISPLAY[type].kind === "passive")}>
                {(type) => {
                  const info = ITEM_DISPLAY[type];
                  return (
                    <div class="flex items-start gap-2 text-sm">
                      <span
                        class="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5 min-w-[3.5rem] text-center"
                        style={{ background: itemAccentCss(type, "default"), color: "#000" }}
                      >
                        {info.label}
                      </span>
                      <span>{t(info.descKey)}</span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Active items */}
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-2">
              {t("bomberman.tutorial.active")}
            </p>
            <div class="space-y-1.5">
              <For each={ITEM_ORDER.filter((type) => ITEM_DISPLAY[type].kind === "active")}>
                {(type) => {
                  const info = ITEM_DISPLAY[type];
                  return (
                    <div class="flex items-start gap-2 text-sm">
                      <span
                        class="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5 min-w-[3.5rem] text-center"
                        style={{ background: itemAccentCss(type, "default"), color: "#000" }}
                      >
                        {info.label}
                      </span>
                      <span>{t(info.descKey)}</span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </section>
      </Modal>
    </Show>
  );
};

export default BombermanTutorial;
