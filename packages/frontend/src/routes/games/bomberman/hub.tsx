import { useNavigate } from "@solidjs/router";
import { createSignal, onMount, For, Show } from "solid-js";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { useWS } from "~/hooks/useWebsocket";

interface RoomSummary {
  gameId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  hostName: string;
}

export function BombermanHub() {
  const navigate = useNavigate();
  const ws = useWS();
  const [rooms, setRooms] = createSignal<RoomSummary[]>([]);
  const [loading, setLoading] = createSignal(false);

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

  async function createRoom() {
    setLoading(true);
    const res = await fetch("/api/bomberman/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: "Quick Match" }),
    });
    const d = (await res.json()) as { success: boolean; data?: { gameId: string } };
    setLoading(false);
    if (d.success && d.data) navigate(`/bomberman/room/${d.data.gameId}`);
  }

  return (
    <ProtectedRoute>
    <div class="container mx-auto p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Bomberman</h1>
        <button class="btn btn-primary" disabled={loading()} onClick={createRoom}>
          {loading() ? "Creating..." : "Create Room"}
        </button>
      </div>
      <Show
        when={rooms().length > 0}
        fallback={<p class="text-center text-gray-500 py-8">No active rooms. Create one to start!</p>}
      >
        <div class="grid gap-3">
          <For each={rooms()}>
            {(room) => (
              <div class="flex items-center gap-4 p-3 bg-base-200 rounded pixel-border">
                <div class="flex-1">
                  <span class="font-bold">{room.roomName}</span>
                  <span class="text-sm text-gray-500 ml-2">by {room.hostName}</span>
                </div>
                <span class="badge">
                  {room.playerCount}/{room.maxPlayers}
                </span>
                <span class={room.phase === "playing" ? "badge badge-warning" : "badge badge-success"}>
                  {room.phase === "playing" ? "Playing" : "Lobby"}
                </span>
                <button class="btn btn-sm btn-primary" onClick={() => navigate(`/bomberman/room/${room.gameId}`)}>
                  Join
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
    </ProtectedRoute>
  );
}
