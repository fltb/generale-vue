import type { BombermanMapDefinition, BombermanMapValidationIssue, BombermanTile } from "@generale/types";
import type { ItemType } from "@generale/types";
import { validateBombermanMapDefinition } from "@generale/bomberman-engine";
import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createMapApi, discardDraftApi, mapDetailApi, updateMapApi } from "~/api/mapApi";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { Alert, Button, Input, LabelText, Select, Spinner } from "~/ui";
import { useT } from "~/i18n/useT";

type Tool = "empty" | "hard_wall" | "soft_wall" | "spawn" | "fixed_item";
const ALL_TOOLS: Tool[] = ["empty", "hard_wall", "soft_wall", "spawn", "fixed_item"];

const ITEM_TYPES: ItemType[] = [
  "BOMB_UP",
  "FIRE_UP",
  "SPEED_UP",
  "KICK",
  "GLOVE",
  "PUNCH",
  "REMOTE",
  "PIERCE",
  "SPIRIT",
];

const MIN_SIZE = 11;
const MAX_SIZE = 31;

function createEmptyMap(w: number, h: number): BombermanMapDefinition {
  return {
    schemaVersion: 1,
    width: w,
    height: h,
    themeId: "classic",
    tiles: Array.from({ length: h }, () => Array.from({ length: w }, (): BombermanTile => ({ type: "empty" }))),
    spawns: [],
    fixedItems: [],
  };
}

export default function BombermanMapEditor() {
  const params = useParams();
  const navigate = useNavigate();
  const { t } = useT();

  const editId = () => params.id as string | undefined;
  const [loading, setLoading] = createSignal(!!editId());
  const [saving, setSaving] = createSignal(false);
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [width, setWidth] = createSignal(15);
  const [height, setHeight] = createSignal(13);
  const [map, setMap] = createSignal<BombermanMapDefinition>(createEmptyMap(15, 13));
  const [tool, setTool] = createSignal<Tool>("empty");
  const [selectedItem, setSelectedItem] = createSignal<ItemType>("BOMB_UP");
  const [error, setError] = createSignal("");
  const [mapId, setMapId] = createSignal(editId());

  const issues = createMemo(() => {
    try {
      return validateBombermanMapDefinition(map());
    } catch {
      return [] as BombermanMapValidationIssue[];
    }
  });

  const isValid = createMemo(() => issues().length === 0);

  // Load existing map
  createEffect(async () => {
    const id = editId();
    if (!id) return;
    try {
      setLoading(true);
      const res = await mapDetailApi(id);
      const d = res.data;
      setName(d.name);
      setDescription(d.description ?? "");
      const data = d.data as BombermanMapDefinition;
      if (data && typeof data === "object" && "tiles" in data && "spawns" in data) {
        setMap(data);
        setWidth(data.width);
        setHeight(data.height);
      }
      setMapId(id);
    } catch {
      setError("Failed to load map");
    } finally {
      setLoading(false);
    }
  });

  function ensureMapSize(w: number, h: number) {
    const m = map();
    const newTiles: BombermanTile[][] = Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => {
        const row = m.tiles[y];
        if (row && x < row.length) {
          return row[x] ?? { type: "empty" as const };
        }
        return { type: "empty" as const };
      }),
    );
    const spawns = m.spawns.filter((s) => s.x < w && s.y < h);
    const fixedItems = m.fixedItems.filter((i) => i.x < w && i.y < h);
    setMap({
      ...m,
      width: w,
      height: h,
      tiles: newTiles,
      spawns,
      fixedItems,
    });
  }

  function handleWidthChange(v: number) {
    const w = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(v)));
    if (w % 2 === 0) return; // must be odd
    setWidth(w);
    ensureMapSize(w, height());
  }

  function handleHeightChange(v: number) {
    const h = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(v)));
    if (h % 2 === 0) return; // must be odd
    setHeight(h);
    ensureMapSize(width(), h);
  }

  function paintCell(row: number, col: number) {
    const m = map();
    const currentTool = tool();

    if (currentTool === "spawn") {
      const already = m.spawns.find((s) => s.x === col && s.y === row);
      const newSpawns = already ? m.spawns.filter((s) => s !== already) : [...m.spawns, { x: col, y: row }];
      setMap({ ...m, spawns: newSpawns });
      return;
    }

    if (currentTool === "fixed_item") {
      const already = m.fixedItems.find((i) => i.x === col && i.y === row);
      if (already) {
        setMap({ ...m, fixedItems: m.fixedItems.filter((i) => i !== already) });
      } else {
        setMap({ ...m, fixedItems: [...m.fixedItems, { x: col, y: row, type: selectedItem() }] });
      }
      return;
    }

    const newTiles = m.tiles.map((rowArr) => [...rowArr]);
    const prevRow = newTiles[row] ?? [];
    const rowCopy = [...prevRow];
    rowCopy[col] = {
      type: currentTool === "empty" ? "empty" : currentTool === "hard_wall" ? "hard_wall" : "soft_wall",
    };
    newTiles[row] = rowCopy;

    // If placing a wall over a spawn, remove the spawn
    const newSpawns =
      currentTool === "hard_wall" || currentTool === "soft_wall"
        ? m.spawns.filter((s) => !(s.x === col && s.y === row))
        : m.spawns;

    // If placing a wall over a fixed item, remove the item
    const newItems =
      currentTool === "hard_wall" || currentTool === "soft_wall"
        ? m.fixedItems.filter((i) => !(i.x === col && i.y === row))
        : m.fixedItems;

    setMap({ ...m, tiles: newTiles, spawns: newSpawns, fixedItems: newItems });
  }

  function getCellLabel(row: number, col: number): string {
    const m = map();
    if (m.spawns.some((s) => s.x === col && s.y === row)) return "S";
    if (m.fixedItems.some((i) => i.x === col && i.y === row)) return "I";
    const tile = m.tiles[row]?.[col];
    if (!tile || tile.type === "empty") return "";
    return tile.type === "hard_wall" ? "H" : "W";
  }

  function getCellColor(row: number, col: number): string {
    const m = map();
    if (m.spawns.some((s) => s.x === col && s.y === row)) return "#22c55e";
    if (m.fixedItems.some((i) => i.x === col && i.y === row)) return "#f59e0b";
    const tile = m.tiles[row]?.[col];
    if (!tile || tile.type === "empty") return "#e5e7eb";
    if (tile.type === "hard_wall") return "#6b7280";
    return "#d1d5db";
  }

  async function handleSave(publish: boolean) {
    const m = map();
    if (!name().trim()) {
      setError("Please enter a map name");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body = {
        gameType: "bomberman" as const,
        name: name().trim(),
        description: description().trim() || undefined,
        width: m.width,
        height: m.height,
        minPlayers: m.spawns.length,
        maxPlayers: m.spawns.length,
        data: m,
        isPublic: publish,
        isDraft: !publish,
      };

      const id = mapId();
      if (id) {
        await updateMapApi(id, body);
      } else {
        const res = await createMapApi(body);
        setMapId(res.data.id);
      }
      navigate("/bomberman/maps");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save map");
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscardDraft() {
    const id = mapId();
    if (!id) return;
    await discardDraftApi(id);
    navigate("/bomberman/maps");
  }

  const gridStyle = () => ({
    display: "grid",
    "grid-template-columns": `repeat(${width()}, minmax(0, 1fr))`,
    "grid-template-rows": `repeat(${height()}, minmax(0, 1fr))`,
    gap: "1px",
    "max-width": `${Math.min(width() * 32, 600)}px`,
  });

  return (
    <ProtectedRoute>
      <div class="container mx-auto max-w-6xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold">{editId() ? t("bomberman.editMap") : t("bomberman.createMap")}</h1>
          <Button variant="ghost" onClick={() => navigate("/bomberman/maps")}>
            {t("bomberman.backToMaps")}
          </Button>
        </div>

        <Show when={loading()}>
          <div class="flex justify-center py-12">
            <Spinner />
          </div>
        </Show>

        <Show when={!loading()}>
          <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            {/* Left: Editor grid */}
            <div>
              <div class="flex gap-4 mb-4 flex-wrap">
                <div class="block">
                  <LabelText>{t("bomberman.width")}</LabelText>
                  <Input
                    type="number"
                    bordered
                    class="w-20"
                    value={width()}
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step={2}
                    onInput={(e) => handleWidthChange(parseInt(e.currentTarget.value, 10) || MIN_SIZE)}
                  />
                </div>
                <div class="block">
                  <LabelText>{t("bomberman.height")}</LabelText>
                  <Input
                    type="number"
                    bordered
                    class="w-20"
                    value={height()}
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step={2}
                    onInput={(e) => handleHeightChange(parseInt(e.currentTarget.value, 10) || MIN_SIZE)}
                  />
                </div>
              </div>

              <div class="border border-base-300 rounded overflow-auto" style={gridStyle()}>
                <For each={map().tiles}>
                  {(row, ri) => (
                    <For each={row}>
                      {(_, ci) => {
                        const r = ri();
                        const c = ci();
                        return (
                          <button
                            type="button"
                            class="w-8 h-8 cursor-pointer border border-base-200 flex items-center justify-center text-xs font-bold"
                            style={`background-color: ${getCellColor(r, c)}; color: ${
                              getCellLabel(r, c) === "S" ? "#fff" : "#374151"
                            }`}
                            onClick={() => paintCell(r, c)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") paintCell(r, c);
                            }}
                            title={`(${c}, ${r}): ${getCellLabel(r, c) || "empty"}`}
                          >
                            {getCellLabel(r, c)}
                          </button>
                        );
                      }}
                    </For>
                  )}
                </For>
              </div>
            </div>

            {/* Right: Toolbar */}
            <div class="space-y-4">
              <div class="block">
                <LabelText>{t("bomberman.mapName")}</LabelText>
                <Input
                  bordered
                  class="w-full"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="My Bomberman Map"
                />
              </div>
              <div class="block">
                <LabelText>{t("bomberman.description")}</LabelText>
                <Input
                  bordered
                  class="w-full"
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                />
              </div>

              <div>
                <LabelText>Tool</LabelText>
                <div class="grid grid-cols-2 gap-1 mt-1">
                  <For each={ALL_TOOLS}>
                    {(tl) => (
                      <Button size="sm" variant={tool() === tl ? "primary" : "secondary"} onClick={() => setTool(tl)}>
                        {t(`bomberman.tool.${tl}`)}
                      </Button>
                    )}
                  </For>
                </div>
              </div>

              <Show when={tool() === "fixed_item"}>
                <div class="block">
                  <LabelText>Item Type</LabelText>
                  <Select
                    bordered
                    class="w-full"
                    value={selectedItem()}
                    onChange={(e) => setSelectedItem(e.currentTarget.value as ItemType)}
                  >
                    <For each={ITEM_TYPES}>{(it) => <option value={it}>{it.replace(/_/g, " ")}</option>}</For>
                  </Select>
                </div>
              </Show>

              {/* Legend */}
              <div class="text-xs space-y-1">
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 inline-block rounded" style="background:#22c55e" /> Spawn
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 inline-block rounded" style="background:#f59e0b" /> Fixed Item
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 inline-block rounded" style="background:#6b7280" /> Hard Wall
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 inline-block rounded" style="background:#d1d5db" /> Soft Wall
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 inline-block rounded border" style="background:#e5e7eb;border-color:#d1d5db" />{" "}
                  Empty
                </div>
              </div>

              {/* Validation */}
              <div>
                <LabelText>Validation</LabelText>
                <Show
                  when={isValid()}
                  fallback={
                    <ul class="text-xs space-y-1 mt-1">
                      <For each={issues()}>
                        {(iss) => (
                          <li class="text-error">
                            {t(`bomberman.validation.${iss.code}` as never, { path: iss.path })}
                          </li>
                        )}
                      </For>
                    </ul>
                  }
                >
                  <p class="text-xs text-success mt-1">No issues</p>
                </Show>
              </div>

              {error() && (
                <Alert variant="error" class="text-sm">
                  {error()}
                </Alert>
              )}

              <div class="flex gap-2">
                <Button variant="primary" onClick={() => handleSave(false)} disabled={saving()}>
                  {saving() ? t("bomberman.savingMap") : t("bomberman.saveMap")}
                </Button>
                <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving() || !isValid()}>
                  {t("bomberman.publishMap")}
                </Button>
                <Show when={editId()}>
                  <Button variant="ghost" onClick={handleDiscardDraft}>
                    Discard Draft
                  </Button>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </ProtectedRoute>
  );
}
