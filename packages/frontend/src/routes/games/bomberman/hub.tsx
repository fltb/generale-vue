import { useNavigate } from "@solidjs/router";
import { createSignal, createMemo, For, Show } from "solid-js";
import { useQuery } from "@tanstack/solid-query";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { useLobbyRealtime } from "~/hooks/useLobbyRealtime";
import { Button, Input, Select, Modal, Checkbox, LabelText, Badge, Alert } from "~/ui";
import { RoomFilter, type BombermanRoomFilter } from "./components/RoomFilter";
import { useT } from "~/i18n/useT";
import { listBombermanRoomsApi, type RoomSummary } from "./api/rooms";

const MAP_SIZES = [
  { key: "small" as const, w: 9, h: 9 },
  { key: "medium" as const, w: 11, h: 11 },
  { key: "large" as const, w: 15, h: 13 },
] as const;

function CreateRoomModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: (gameId: string, password?: string) => void;
}) {
  const { t } = useT();
  const [roomName, setRoomName] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [mapSizeIdx, setMapSizeIdx] = createSignal(2);
  const [maxPlayers, setMaxPlayers] = createSignal(4);
  const [roundTime, setRoundTime] = createSignal(120);
  const [bombLimit, setBombLimit] = createSignal(2);
  const [suddenDeath, setSuddenDeath] = createSignal(true);
  const [dropRate, setDropRate] = createSignal(0.6);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleCreate() {
    const name = roomName().trim();
    if (!name) {
      setError(t("Please enter a room name"));
      return;
    }
    setLoading(true);
    setError("");
    const pw = password().trim();
    const ms = MAP_SIZES[mapSizeIdx()];
    const config = {
      mapWidth: ms.w,
      mapHeight: ms.h,
      playerLimit: maxPlayers(),
      roundTimeSec: roundTime(),
      bombLimit: bombLimit(),
      shrinkEnabled: suddenDeath(),
      itemDropRate: dropRate(),
    };
    const body: Record<string, unknown> = { roomName: name, config };
    if (pw) body.password = pw;
    const res = await fetch("/api/bomberman/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await res.json()) as { success: boolean; error?: string; data?: { gameId: string } };
    setLoading(false);
    if (d.success && d.data) {
      if (pw) sessionStorage.setItem(`bomb_room_pwd_${d.data.gameId}`, pw);
      props.onCreated(d.data.gameId, pw || undefined);
    } else {
      setError(d.error || t("Failed to create room"));
    }
  }

  return (
    <Show when={props.open}>
      <Modal boxClass="max-w-md">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-bold">{t("bomberman.createRoom")}</h2>
          <Button size="sm" variant="ghost" onClick={props.onClose}>
            {t("bomberman.close")}
          </Button>
        </div>
        <div class="space-y-3">
          <div class="block">
            <LabelText>{t("bomberman.roomName")}</LabelText>
            <Input
              bordered
              class="w-full"
              placeholder={t("bomberman.roomName")}
              value={roomName()}
              onInput={(e) => setRoomName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <div class="block">
            <LabelText>{t("bomberman.password")}</LabelText>
            <Input
              bordered
              class="w-full"
              placeholder={t("Leave empty for public room")}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="block">
              <LabelText>{t("bomberman.mapSize")}</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(mapSizeIdx())}
                onChange={(e) => setMapSizeIdx(Number(e.currentTarget.value))}
              >
                {MAP_SIZES.map((s, i) => (
                  <option value={i}>
                    {t(`bomberman.${s.key}`)} ({s.w}\u00d7{s.h})
                  </option>
                ))}
              </Select>
            </div>
            <div class="block">
              <LabelText>{t("bomberman.maxPlayers")}</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(maxPlayers())}
                onChange={(e) => setMaxPlayers(Number(e.currentTarget.value))}
              >
                {[2, 3, 4].map((n) => (
                  <option value={n}>{n}</option>
                ))}
              </Select>
            </div>
            <div class="block">
              <LabelText>{t("bomberman.roundTime")}</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(roundTime())}
                onChange={(e) => setRoundTime(Number(e.currentTarget.value))}
              >
                <option value={60}>60s</option>
                <option value={120}>120s</option>
                <option value={120}>120s</option>
                <option value={180}>180s</option>
                <option value={300}>300s</option>
              </Select>
            </div>
            <div class="block">
              <LabelText>{t("bomberman.bombLimit")}</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(bombLimit())}
                onChange={(e) => setBombLimit(Number(e.currentTarget.value))}
              >
                {[1, 2, 3].map((n) => (
                  <option value={n}>{n}</option>
                ))}
              </Select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="block">
              <LabelText>{t("bomberman.itemDropRate")}</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(dropRate())}
                onChange={(e) => setDropRate(Number(e.currentTarget.value))}
              >
                <option value={0}>{t("bomberman.none")} (0%)</option>
                <option value={0.3}>{t("bomberman.low")} (30%)</option>
                <option value={0.6}>{t("bomberman.medium")} (60%)</option>
                <option value={1}>{t("bomberman.high")} (100%)</option>
              </Select>
            </div>
            <div class="flex items-center gap-2 mt-6">
              <Checkbox checked={suddenDeath()} onChange={(e) => setSuddenDeath(e.currentTarget.checked)} />
              <LabelText>{t("bomberman.suddenDeath")}</LabelText>
            </div>
          </div>
          {error() && (
            <Alert variant="error" class="text-sm">
              {error()}
            </Alert>
          )}
          <div class="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={props.onClose} disabled={loading()}>
              {t("bomberman.cancel")}
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={loading()}>
              {loading() ? t("Creating...") : t("bomberman.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </Show>
  );
}

export function BombermanHub() {
  const { t } = useT();
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [filter, setFilter] = createSignal<BombermanRoomFilter>({});

  const [queryKeyFilter, setQueryKeyFilter] = createSignal<Record<string, string>>({});

  const roomsQuery = useQuery(() => ({
    queryKey: ["bomberman-rooms", queryKeyFilter(), 0, 50] as const,
    queryFn: () => listBombermanRoomsApi(queryKeyFilter()),
  }));

  useLobbyRealtime(
    () => {
      // build server-friendly filter record matching what backend expects
      const f = filter();
      const q: Record<string, string | undefined> = {};
      if (f.roomName) q.roomName = f.roomName;
      if (f.status && f.status !== "all") q.status = f.status;
      if (f.hasPassword && f.hasPassword !== "all") q.hasPassword = f.hasPassword;
      if (f.sortBy) q.sortBy = f.sortBy;
      if (f.sortOrder) q.sortOrder = f.sortOrder;
      setQueryKeyFilter(Object.fromEntries(Object.entries(q).filter(([, v]) => v != null)) as Record<string, string>);
      return q as Record<string, string>;
    },
    {
      queryKeyPrefix: "bomberman-rooms",
      domain: "lobby-bomberman",
      extractId: (p) => (p as RoomSummary).gameId ?? "",
      extractDeleteId: (p) => (p as { id: string }).id ?? "",
      offset: 0,
      limit: 50,
    },
  );

  const filteredRooms = createMemo(() => {
    const f = filter();
    return (roomsQuery.data ?? [])
      .filter((r) => {
        if (f.roomName && !r.roomName.toLowerCase().includes(f.roomName.toLowerCase())) return false;
        if (f.status === "lobby" && r.phase !== "lobby") return false;
        if (f.status === "playing" && r.phase !== "playing") return false;
        if (f.hasPassword === "yes" && !r.hasPassword) return false;
        if (f.hasPassword === "no" && r.hasPassword) return false;
        return true;
      })
      .sort((a, b) => {
        const order = f.sortOrder === "desc" ? -1 : 1;
        if (f.sortBy === "playerCount") return (a.playerCount - b.playerCount) * order;
        return a.roomName.localeCompare(b.roomName) * order;
      });
  });

  function handleCreated(gameId: string, password?: string) {
    setShowCreateModal(false);
    const qs = password ? `?password=${encodeURIComponent(password)}` : "";
    navigate(`/bomberman/room/${gameId}${qs}`);
  }

  return (
    <ProtectedRoute>
      <div class="container mx-auto max-w-3xl p-8">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold">{t("bomberman.title")}</h1>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            {t("bomberman.createRoom")}
          </Button>
        </div>
        <RoomFilter value={filter()} onChange={(f) => setFilter(f)} />
        <Show
          when={filteredRooms().length > 0}
          fallback={
            <div class="text-center py-16">
              <div class="text-4xl mb-4">💣</div>
              <p class="text-base-content/50">{t("No active rooms. Create one to start!")}</p>
            </div>
          }
        >
          <div class="grid gap-3">
            <For each={filteredRooms()}>
              {(room) => (
                // biome-ignore lint/a11y/useSemanticElements: compound card with nested interactive buttons
                <div
                  role="button"
                  class="flex items-center gap-4 p-4 bg-base-200 rounded-xl pixel-border hover:bg-base-300 transition-colors cursor-pointer"
                  onClick={() => navigate(`/bomberman/room/${room.gameId}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/bomberman/room/${room.gameId}`);
                  }}
                  tabIndex={0}
                >
                  <div class="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center text-lg">💣</div>
                  <div class="flex-1">
                    <div class="font-bold">
                      {room.roomName}
                      {room.hasPassword ? <span class="text-xs text-warning ml-1">🔒</span> : null}
                    </div>
                    <div class="text-xs text-base-content/50">
                      {t("Host:")} {room.hostName}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {room.playerCount}/{room.maxPlayers}
                  </Badge>
                  <Badge variant={room.phase === "playing" ? "warning" : "success"} size="sm">
                    {room.phase === "playing" ? t("bomberman.playing") : t("bomberman.lobby")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/bomberman/room/${room.gameId}`);
                    }}
                  >
                    {t("Join")}
                  </Button>
                </div>
              )}
            </For>
          </div>
        </Show>
        <CreateRoomModal open={showCreateModal()} onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
      </div>
    </ProtectedRoute>
  );
}
