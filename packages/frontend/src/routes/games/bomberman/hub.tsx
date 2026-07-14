import { useNavigate } from "@solidjs/router";
import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { useWS } from "~/hooks/useWebsocket";
import { Button, Input, Select, Modal, Checkbox, LabelText } from "~/ui";
import { RoomFilter, type BombermanRoomFilter } from "./components/RoomFilter";

interface RoomSummary {
  gameId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  hostName: string;
  hasPassword: boolean;
}

const MAP_SIZES = [
  { label: "Small (9\u00d79)", w: 9, h: 9 },
  { label: "Medium (11\u00d711)", w: 11, h: 11 },
  { label: "Large (15\u00d713)", w: 15, h: 13 },
] as const;

function CreateRoomModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: (gameId: string, password?: string) => void;
}) {
  const [roomName, setRoomName] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [mapSizeIdx, setMapSizeIdx] = createSignal(2);
  const [maxPlayers, setMaxPlayers] = createSignal(4);
  const [roundTime, setRoundTime] = createSignal(180);
  const [bombLimit, setBombLimit] = createSignal(1);
  const [suddenDeath, setSuddenDeath] = createSignal(false);
  const [dropRate, setDropRate] = createSignal(0.6);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleCreate() {
    const name = roomName().trim();
    if (!name) {
      setError("Please enter a room name");
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
      setError(d.error || "Failed to create room");
    }
  }

  return (
    <Show when={props.open}>
      <Modal boxClass="max-w-md">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-bold">Create Bomberman Room</h2>
          <Button size="sm" variant="ghost" onClick={props.onClose}>
            Close
          </Button>
        </div>
        <div class="space-y-3">
          <div class="block">
            <LabelText>Room Name</LabelText>
            <Input
              bordered
              class="w-full"
              placeholder="My Bomberman Room"
              value={roomName()}
              onInput={(e) => setRoomName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <div class="block">
            <LabelText>Password (optional)</LabelText>
            <Input
              bordered
              class="w-full"
              placeholder="Leave empty for public room"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="block">
              <LabelText>Map Size</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(mapSizeIdx())}
                onChange={(e) => setMapSizeIdx(Number(e.currentTarget.value))}
              >
                {MAP_SIZES.map((s, i) => (
                  <option value={i}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div class="block">
              <LabelText>Max Players</LabelText>
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
              <LabelText>Round Time</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(roundTime())}
                onChange={(e) => setRoundTime(Number(e.currentTarget.value))}
              >
                <option value={60}>60s</option>
                <option value={120}>120s</option>
                <option value={180}>180s (Default)</option>
                <option value={300}>300s</option>
              </Select>
            </div>
            <div class="block">
              <LabelText>Bomb Limit</LabelText>
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
              <LabelText>Item Drop Rate</LabelText>
              <Select
                bordered
                class="w-full"
                value={String(dropRate())}
                onChange={(e) => setDropRate(Number(e.currentTarget.value))}
              >
                <option value={0}>None (0%)</option>
                <option value={0.3}>Low (30%)</option>
                <option value={0.6}>Medium (60%)</option>
                <option value={1}>High (100%)</option>
              </Select>
            </div>
            <div class="flex items-center gap-2 mt-6">
              <Checkbox checked={suddenDeath()} onChange={(e) => setSuddenDeath(e.currentTarget.checked)} />
              <LabelText>Sudden Death</LabelText>
            </div>
          </div>
          {error() && <div class="alert alert-error text-sm">{error()}</div>}
          <div class="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={props.onClose} disabled={loading()}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={loading()}>
              {loading() ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </Show>
  );
}

export function BombermanHub() {
  const navigate = useNavigate();
  const ws = useWS();
  const [rooms, setRooms] = createSignal<RoomSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [filter, setFilter] = createSignal<BombermanRoomFilter>({});

  const filteredRooms = createMemo(() => {
    const f = filter();
    return rooms()
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

  onMount(() => {
    fetchAndSetRooms();
    function tryOpenLobby() {
      if (ws?.isConnected) {
        const sub = ws.getOrCreateSub("lobby-bomberman");
        sub?.onMessage((msg: unknown) => {
          const m = msg as { type: string; payload: RoomSummary[] };
          if (m.type === "ROOM_LIST_UPDATE") setRooms(m.payload);
        });
        ws.openDomain("lobby-bomberman", {});
      } else {
        setTimeout(tryOpenLobby, 200);
      }
    }
    tryOpenLobby();
  });

  async function fetchAndSetRooms() {
    const res = await fetch("/api/bomberman/room/list");
    const d = (await res.json()) as { success: boolean; data: RoomSummary[] };
    if (d.success) setRooms(d.data);
  }

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
            <h1 class="text-3xl font-bold">Bomberman</h1>
            <p class="text-sm text-base-content/50">Classic bomb battle arena</p>
          </div>
          <button type="button" class="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Room
          </button>
        </div>
        <RoomFilter value={filter()} onChange={(f) => setFilter(f)} />
        <Show
          when={filteredRooms().length > 0}
          fallback={
            <div class="text-center py-16">
              <div class="text-4xl mb-4">💣</div>
              <p class="text-base-content/50">No active rooms. Create one to start!</p>
            </div>
          }
        >
          <div class="grid gap-3">
            <For each={filteredRooms()}>
              {(room) => (
                <div
                  role="button"
                  class="flex items-center gap-4 p-4 bg-base-200 rounded-xl pixel-border hover:bg-base-300 transition-colors cursor-pointer"
                  onClick={() => navigate(`/bomberman/room/${room.gameId}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/bomberman/room/${room.gameId}`); }}
                  tabIndex={0}
                >
                  <div class="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center text-lg">💣</div>
                  <div class="flex-1">
                    <div class="font-bold">
                      {room.roomName}
                      {room.hasPassword ? <span class="text-xs text-warning ml-1">🔒</span> : null}
                    </div>
                    <div class="text-xs text-base-content/50">Host: {room.hostName}</div>
                  </div>
                  <span class="badge badge-outline">
                    {room.playerCount}/{room.maxPlayers}
                  </span>
                  <span
                    class={room.phase === "playing" ? "badge badge-warning badge-sm" : "badge badge-success badge-sm"}
                  >
                    {room.phase === "playing" ? "In Game" : "Lobby"}
                  </span>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/bomberman/room/${room.gameId}`);
                    }}
                  >
                    Join
                  </button>
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
