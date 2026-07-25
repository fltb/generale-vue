import type { BombermanMapDefinition, BombermanMapValidationIssue } from "@generale/types";
import { validateBombermanMapDefinition } from "@generale/bomberman-engine";
import { Title } from "@solidjs/meta";
import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { mapDetailApi } from "~/api/mapApi";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { Alert, Badge, Button, Spinner } from "~/ui";
import { useT } from "~/i18n/useT";

function getCellColor(row: number, col: number, map: BombermanMapDefinition): string {
  if (map.spawns.some((s) => s.x === col && s.y === row)) return "#22c55e";
  if (map.fixedItems.some((i) => i.x === col && i.y === row)) return "#f59e0b";
  const tile = map.tiles[row]?.[col];
  if (!tile || tile.type === "empty") return "#e5e7eb";
  if (tile.type === "hard_wall") return "#6b7280";
  return "#d1d5db";
}

function getCellLabel(row: number, col: number, map: BombermanMapDefinition): string {
  if (map.spawns.some((s) => s.x === col && s.y === row)) return "S";
  if (map.fixedItems.some((i) => i.x === col && i.y === row)) return "I";
  return "";
}

const ROW_HEIGHT = 28;

export default function BombermanMapPreview() {
  const params = useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const mapId = () => params.id as string;

  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [mapName, setMapName] = createSignal("");
  const [map, setMap] = createSignal<BombermanMapDefinition | null>(null);

  const issues = createMemo(() => {
    const m = map();
    if (!m) return [];
    try {
      return validateBombermanMapDefinition(m);
    } catch {
      return [] as BombermanMapValidationIssue[];
    }
  });

  createEffect(async () => {
    const id = mapId();
    if (!id) return;
    try {
      setLoading(true);
      const res = await mapDetailApi(id, false);
      const d = res.data;
      setMapName(d.name);
      const data = d.data as BombermanMapDefinition;
      if (data && typeof data === "object" && "tiles" in data) {
        setMap(data);
      } else {
        setError("Invalid map data");
      }
    } catch {
      setError("Failed to load map");
    } finally {
      setLoading(false);
    }
  });

  const gridWidth = () => {
    const m = map();
    if (!m) return 0;
    return m.width * ROW_HEIGHT;
  };

  const gridHeight = () => {
    const m = map();
    if (!m) return 0;
    return m.height * ROW_HEIGHT;
  };

  return (
    <ProtectedRoute>
      <Title>{mapName() || "Map Preview"}</Title>
      <div class="container mx-auto max-w-4xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold">{mapName() || t("bomberman.previewMap")}</h1>
          <Button variant="ghost" onClick={() => navigate("/bomberman/maps")}>
            {t("bomberman.backToMaps")}
          </Button>
        </div>

        <Show when={loading()}>
          <div class="flex justify-center py-12">
            <Spinner />
          </div>
        </Show>

        <Show when={error()}>
          <Alert variant="error" class="mb-4">
            {error()}
          </Alert>
          <Show when={!loading()}>
            <Button variant="primary" onClick={() => navigate("/bomberman/maps")}>
              {t("bomberman.backToMaps")}
            </Button>
          </Show>
        </Show>

        <Show when={!(loading() || error()) && map()}>
          {(m) => (
            <div class="space-y-6">
              {/* Info */}
              <div class="flex gap-4 flex-wrap">
                <Badge variant="outline">
                  {m().width}&times;{m().height}
                </Badge>
                <Badge variant="outline">{m().spawns.length} spawns</Badge>
                <Badge variant="outline">{m().fixedItems.length} fixed items</Badge>
                <Show when={issues().length === 0}>
                  <Badge variant="success">Valid</Badge>
                </Show>
              </div>

              {/* Validation issues */}
              <Show when={issues().length > 0}>
                <Alert variant="warning" class="text-sm">
                  <ul class="list-disc list-inside">
                    <For each={issues()}>
                      {(iss) => (
                        <li>
                          {iss.code}: {iss.path}
                        </li>
                      )}
                    </For>
                  </ul>
                </Alert>
              </Show>

              {/* Grid */}
              <div
                class="border border-base-300 rounded overflow-auto inline-grid"
                style={{
                  display: "grid",
                  "grid-template-columns": `repeat(${m().width}, ${ROW_HEIGHT}px)`,
                  "grid-template-rows": `repeat(${m().height}, ${ROW_HEIGHT}px)`,
                  gap: "1px",
                  width: `${gridWidth()}px`,
                  height: `${gridHeight()}px`,
                }}
              >
                <For each={m().tiles}>
                  {(row, ri) => (
                    <For each={row}>
                      {(_, ci) => {
                        const r = ri();
                        const c = ci();
                        return (
                          <div
                            class="flex items-center justify-center text-xs font-bold"
                            style={{
                              "background-color": getCellColor(r, c, m()),
                              color: getCellLabel(r, c, m()) ? "#fff" : "transparent",
                              width: `${ROW_HEIGHT}px`,
                              height: `${ROW_HEIGHT}px`,
                            }}
                            title={`(${c}, ${r})${getCellLabel(r, c, m()) ? `: ${getCellLabel(r, c, m())}` : ""}`}
                          >
                            {getCellLabel(r, c, m())}
                          </div>
                        );
                      }}
                    </For>
                  )}
                </For>
              </div>
            </div>
          )}
        </Show>
      </div>
    </ProtectedRoute>
  );
}
