import type { BombermanMapRef, BombermanMapSource } from "@generale/types";
import { createResource, createSignal, For, Show } from "solid-js";
import { listMapsApi } from "~/api/mapApi";
import { Button, Card, LabelText, Select, Spinner } from "~/ui";
import { useT } from "~/i18n/useT";
import { BOMBERMAN_PRESET_DEFINITIONS, BOMBERMAN_THEME_MANIFEST } from "@generale/types";
const PRESET_IDS = Object.keys(BOMBERMAN_PRESET_DEFINITIONS) as Array<"classic" | "sparse" | "dense">;

interface Props {
  value: BombermanMapSource;
  onChange: (source: BombermanMapSource) => void;
}

export function BombermanMapSourcePicker(props: Props) {
  const { t } = useT();
  const [sourceType, setSourceType] = createSignal(props.value.type);
  const [themeId, setThemeId] = createSignal(
    props.value.type === "procedural" ? (props.value as { themeId: string }).themeId : "classic",
  );
  const [presetId, setPresetId] = createSignal<"classic" | "sparse" | "dense">(
    props.value.type === "preset"
      ? (props.value as { type: "preset"; id: "classic" | "sparse" | "dense" }).id
      : "classic",
  );
  const [workshopId, setWorkshopId] = createSignal(
    props.value.type === "workshop" ? (props.value as BombermanMapRef).id : "",
  );
  const [rotationMaps, setRotationMaps] = createSignal<BombermanMapRef[]>(
    props.value.type === "rotation" ? (props.value as { maps: BombermanMapRef[] }).maps : [],
  );

  const [workshopMaps] = createResource(
    () => sourceType(),
    async () => {
      if (sourceType() !== "workshop" && sourceType() !== "rotation") return [];
      const res = await listMapsApi({ gameType: "bomberman" });
      return res.data;
    },
  );

  function handleTypeChange(newType: string) {
    const t = newType as BombermanMapSource["type"];
    setSourceType(t);
    if (t === "procedural") props.onChange({ type: "procedural", themeId: themeId() });
    else if (t === "preset") props.onChange({ type: "preset", id: presetId() });
    else if (t === "workshop") props.onChange({ type: "workshop", id: workshopId() });
    else if (t === "rotation") props.onChange({ type: "rotation", maps: rotationMaps() });
  }

  function addToRotation(ref: BombermanMapRef) {
    const current = rotationMaps();
    const already = current.some((m) => m.type === ref.type && m.id === ref.id);
    if (already) return;
    const next = [...current, ref];
    setRotationMaps(next);
    props.onChange({ type: "rotation", maps: next });
  }

  function removeFromRotation(idx: number) {
    const next = rotationMaps().filter((_, i) => i !== idx);
    setRotationMaps(next);
    props.onChange({ type: "rotation", maps: next });
  }

  return (
    <div class="space-y-3">
      <div class="block">
        <LabelText>{t("bomberman.mapSource")}</LabelText>
        <Select bordered class="w-full" value={sourceType()} onChange={(e) => handleTypeChange(e.currentTarget.value)}>
          <option value="procedural">{t("bomberman.mapSourceProcedural")}</option>
          <option value="preset">{t("bomberman.mapSourcePreset")}</option>
          <option value="workshop">{t("bomberman.mapSourceWorkshop")}</option>
          <option value="rotation">{t("bomberman.mapSourceRotation")}</option>
        </Select>
      </div>

      <Show when={sourceType() === "procedural"}>
        <div class="block">
          <LabelText>{t("bomberman.theme")}</LabelText>
          <Select
            bordered
            class="w-full"
            value={themeId()}
            onChange={(e) => {
              setThemeId(e.currentTarget.value);
              props.onChange({ type: "procedural", themeId: e.currentTarget.value });
            }}
          >
            <For each={BOMBERMAN_THEME_MANIFEST}>
              {(theme) => (
                <option value={theme.id}>
                  {theme.id.charAt(0).toUpperCase() + theme.id.slice(1).replace("-", " ")}
                </option>
              )}
            </For>
          </Select>
        </div>
      </Show>

      <Show when={sourceType() === "preset"}>
        <div class="block">
          <LabelText>{t("bomberman.mapSourcePreset")}</LabelText>
          <Select
            bordered
            class="w-full"
            value={presetId()}
            onChange={(e) => {
              const id = e.currentTarget.value as "classic" | "sparse" | "dense";
              setPresetId(id);
              props.onChange({ type: "preset", id });
            }}
          >
            <For each={PRESET_IDS}>
              {(pid) => (
                <option value={pid}>
                  {pid.charAt(0).toUpperCase() + pid.slice(1)} ({BOMBERMAN_PRESET_DEFINITIONS[pid].width}&times;
                  {BOMBERMAN_PRESET_DEFINITIONS[pid].height})
                </option>
              )}
            </For>
          </Select>
        </div>
      </Show>

      <Show when={sourceType() === "workshop"}>
        <div class="block">
          <LabelText>{t("bomberman.selectWorkshopMap")}</LabelText>
          <Show
            when={workshopMaps()}
            fallback={
              <div class="flex items-center gap-2 text-sm text-base-content/50">
                <Spinner />
              </div>
            }
          >
            <Select
              bordered
              class="w-full"
              value={workshopId()}
              onChange={(e) => {
                const id = e.currentTarget.value;
                setWorkshopId(id);
                if (id) props.onChange({ type: "workshop", id });
              }}
            >
              <option value="">{t("bomberman.noMapSelected")}</option>
              <For each={workshopMaps()}>
                {(m) => (
                  <option value={m.id}>
                    {m.name} ({m.width}&times;{m.height})
                  </option>
                )}
              </For>
            </Select>
          </Show>
        </div>
      </Show>

      <Show when={sourceType() === "rotation"}>
        <div class="space-y-2">
          <LabelText>{t("bomberman.rotationMaps")}</LabelText>
          <Show when={workshopMaps()}>
            <div class="flex gap-2">
              <Select
                bordered
                class="flex-1"
                value=""
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  if (!val) return;
                  addToRotation({ type: "workshop", id: val });
                }}
              >
                <option value="">{t("bomberman.addToRotation")}</option>
                <For each={workshopMaps()}>{(m) => <option value={m.id}>{m.name}</option>}</For>
              </Select>
            </div>
          </Show>
          <Show
            when={rotationMaps().length > 0}
            fallback={<p class="text-xs text-base-content/40">{t("bomberman.noMapSelected")}</p>}
          >
            <div class="space-y-2">
              <For each={rotationMaps()}>
                {(ref, idx) => (
                  <Card class="p-2 flex items-center justify-between">
                    <span class="text-sm">
                      {ref.type === "workshop" ? "Workshop: " : ""}
                      {ref.id}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => removeFromRotation(idx())}>
                      {t("bomberman.removeFromRotation")}
                    </Button>
                  </Card>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
