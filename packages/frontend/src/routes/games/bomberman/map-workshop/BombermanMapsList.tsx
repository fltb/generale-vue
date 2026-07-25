import type { MapSumaryRespBody } from "@generale/types";
import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { deleteMapApi, forkMapApi, listMapsApi, mapThumbnailUrl, myMapsApi } from "~/api/mapApi";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { Badge, Button, Card, Input, Select, Spinner } from "~/ui";
import { useT } from "~/i18n/useT";

const SORT_OPTIONS = [
  { value: "updated", label: "Newest" },
  { value: "usage", label: "Most popular" },
  { value: "largest", label: "Largest" },
  { value: "smallest", label: "Smallest" },
];

export default function BombermanMapsList() {
  const { t } = useT();
  const navigate = useNavigate();
  const [tab, setTab] = createSignal<"public" | "my">("public");
  const [searchText, setSearchText] = createSignal("");
  const [sortBy, setSortBy] = createSignal("updated");

  const query = () => {
    const q: Record<string, string> = { gameType: "bomberman" };
    if (searchText().trim()) q.search = searchText().trim();
    if (sortBy() !== "updated") q.sort = sortBy();
    return q;
  };

  const [maps, { refetch }] = createResource(
    () => ({ tab: tab(), query: query() }),
    async (src) => {
      if (src.tab === "my") {
        const res = await myMapsApi(src.query);
        return res.data;
      }
      const res = await listMapsApi(src.query);
      return res.data;
    },
  );

  async function handleDelete(id: string) {
    if (!window.confirm(t("bomberman.confirmDelete"))) return;
    await deleteMapApi(id);
    refetch();
  }

  async function handleFork(id: string) {
    await forkMapApi(id);
    refetch();
  }

  return (
    <ProtectedRoute>
      <Title>{t("bomberman.mapWorkshop")}</Title>
      <div class="container mx-auto max-w-5xl p-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold">{t("bomberman.mapWorkshop")}</h1>
          <Button variant="primary" onClick={() => navigate("/bomberman/maps/editor")}>
            {t("bomberman.createMap")}
          </Button>
        </div>

        <div class="flex gap-4 items-end mb-4 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <Input
              bordered
              class="w-full"
              placeholder={t("Search...")}
              value={searchText()}
              onInput={(e) => setSearchText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") refetch();
              }}
            />
          </div>
          <Select bordered value={sortBy()} onChange={(e) => setSortBy(e.currentTarget.value)}>
            <For each={SORT_OPTIONS}>{(opt) => <option value={opt.value}>{opt.label}</option>}</For>
          </Select>
        </div>

        <div class="tabs tabs-bordered mb-4">
          <button
            type="button"
            class="tab"
            classList={{ "tab-active": tab() === "public" }}
            onClick={() => setTab("public")}
          >
            {t("bomberman.publicMaps")}
          </button>
          <button type="button" class="tab" classList={{ "tab-active": tab() === "my" }} onClick={() => setTab("my")}>
            {t("bomberman.myMaps")}
          </button>
        </div>

        <Show
          when={maps()}
          fallback={
            <div class="flex justify-center py-12">
              <Spinner />
            </div>
          }
        >
          <Show
            when={(maps()?.length ?? 0) > 0}
            fallback={<div class="text-center py-16 text-base-content/50">{t("bomberman.noMaps")}</div>}
          >
            <div class="grid gap-4 mt-4 sm:grid-cols-2 lg:grid-cols-3">
              <For each={maps()}>
                {(map) => (
                  <MapCard
                    map={map}
                    isOwner={tab() === "my"}
                    onEdit={(id) => navigate(`/bomberman/maps/editor/${id}`)}
                    onPreview={(id) => navigate(`/bomberman/maps/preview/${id}`)}
                    onDelete={handleDelete}
                    onFork={handleFork}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </ProtectedRoute>
  );
}

function MapCard(props: {
  map: MapSumaryRespBody;
  isOwner: boolean;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
}) {
  const { t } = useT();
  const m = () => props.map;

  return (
    <Card class="p-4">
      <div class="flex gap-3">
        <Show when={m().hasCustomThumbnail}>
          <img src={mapThumbnailUrl(m().id)} alt={m().name} class="w-20 h-20 rounded object-cover shrink-0" />
        </Show>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm truncate">{m().name}</div>
          <Show when={m().description}>
            <div class="text-xs text-base-content/50 truncate mt-0.5">{m().description}</div>
          </Show>
          <div class="text-xs text-base-content/40 mt-1">
            {m().width}&times;{m().height} &middot; {m().authorName}
          </div>
          <div class="flex gap-1 mt-2 flex-wrap">
            <Badge size="sm" variant="outline">
              {m().usageCount} plays
            </Badge>
            <Show when={m().isDraft}>
              <Badge size="sm" variant="warning">
                Draft
              </Badge>
            </Show>
          </div>
        </div>
      </div>
      <div class="flex gap-2 mt-3 justify-end">
        <Button size="sm" variant="ghost" onClick={() => props.onPreview(m().id)}>
          {t("bomberman.previewMap")}
        </Button>
        <Show when={props.isOwner}>
          <Button size="sm" variant="secondary" onClick={() => props.onEdit(m().id)}>
            {t("bomberman.editMap")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => props.onDelete(m().id)}>
            {t("bomberman.deleteMap")}
          </Button>
        </Show>
        <Show when={!props.isOwner}>
          <Button size="sm" variant="ghost" onClick={() => props.onFork(m().id)}>
            {t("bomberman.forkMap")}
          </Button>
        </Show>
      </div>
    </Card>
  );
}
