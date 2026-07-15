/**
 * Rooms list API wrapper for bomberman.
 * Used by useGameListQuery to fetch rooms from the server.
 */

export interface RoomSummary {
  gameId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  hostName: string;
  hasPassword: boolean;
}

export async function listBombermanRoomsApi(params: Record<string, string>): Promise<RoomSummary[]> {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `/api/bomberman/room/list?${qs}` : "/api/bomberman/room/list";
  const res = await fetch(url);
  const d = (await res.json()) as { success: boolean; data: RoomSummary[] };
  if (!d.success) throw new Error("Failed to list rooms");
  return d.data;
}
