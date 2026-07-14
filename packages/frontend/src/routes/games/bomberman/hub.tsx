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
  hasPassword: boolean;
}

function CreateRoomModal(props: { open: boolean; onClose: () => void; onCreated: (gameId: string, password?: string) => void }) {
  const [roomName, setRoomName] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleCreate() {
    const name = roomName().trim();
    if (!name) { setError("Please enter a room name"); return; }
    setLoading(true);
    setError("");
    const body: Record<string, unknown> = { roomName: name };
    const pw = password().trim();
    if (pw) body.password = pw;
    const res = await fetch("/api/bomberman/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await res.json()) as { success: boolean; error?: string; data?: { gameId: string } };
    setLoading(false);
    if (d.success && d.data) {
      props.onCreated(d.data.gameId, pw || undefined);
    } else {
      setError(d.error || "Failed to create room");
    }
  }

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={props.onClose}>
        <div class="bg-base-200 p-6 rounded pixel-border w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <h2 class="text-xl font-bold mb-4">Create Bomberman Room</h2>
          <div class="form-control mb-4">
            <label class="label" for="room-name-input"><span class="label-text">Room Name</span></label>
            <input id="room-name-input" type="text" class="input input-bordered w-full" placeholder="My Bomberman Room"
              value={roomName()} onInput={(e) => setRoomName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} />
          </div>
            <div class="form-control mb-4">
              <label class="label" for="room-password-input"><span class="label-text">Password (optional)</span></label>
              <input id="room-password-input" type="text" class="input input-bordered w-full" placeholder="Leave empty for public room"
                value={password()} onInput={(e) => setPassword(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} />
            </div>
          {error() && <div class="alert alert-error mb-4 text-sm">{error()}</div>}
          <div class="flex gap-2 justify-end">
            <button class="btn btn-ghost" onClick={props.onClose} disabled={loading()}>Cancel</button>
            <button class="btn btn-primary" onClick={handleCreate} disabled={loading()}>{loading() ? "Creating..." : "Create"}</button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export function BombermanHub() {
  const navigate = useNavigate();
  const ws = useWS();
  const [rooms, setRooms] = createSignal<RoomSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = createSignal(false);

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
        <button class="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          Create Room
        </button>
      </div>
      <Show
        when={rooms().length > 0}
        fallback={<div class="text-center py-16"><div class="text-4xl mb-4">💣</div><p class="text-base-content/50">No active rooms. Create one to start!</p></div>}
      >
        <div class="grid gap-3">
          <For each={rooms()}>
            {(room) => (
              <div class="flex items-center gap-4 p-4 bg-base-200 rounded-xl pixel-border hover:bg-base-300 transition-colors cursor-pointer" onClick={() => navigate(`/bomberman/room/${room.gameId}`)}>
                <div class="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center text-lg">💣</div>
                <div class="flex-1">
                  <div class="font-bold">{room.roomName}{room.hasPassword ? <span class="text-xs text-warning ml-1">🔒</span> : null}</div>
                  <div class="text-xs text-base-content/50">Host: {room.hostName}</div>
                </div>
                <span class="badge badge-outline">{room.playerCount}/{room.maxPlayers}</span>
                <span class={room.phase === "playing" ? "badge badge-warning badge-sm" : "badge badge-success badge-sm"}>
                  {room.phase === "playing" ? "In Game" : "Lobby"}
                </span>
                <button class="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); navigate(`/bomberman/room/${room.gameId}`); }}>Join</button>
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
