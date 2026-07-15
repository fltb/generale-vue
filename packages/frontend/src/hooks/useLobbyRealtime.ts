// src/hooks/useLobbyRealtime.ts

import type { ListGamesQuery } from "@generale/types";
import {
  type LobbyClientEvent,
  LobbyClientEventType,
  type LobbyMessage,
  LobbyServerMessageType as SharedLobbyServerMessageType,
} from "@generale/types";
import { useQueryClient } from "@tanstack/solid-query";
import { createEffect, createMemo, on, onCleanup } from "solid-js";
import { useSubConnector, useWS } from "~/hooks/useWebsocket";
import type { WSOpenPayloadBase } from "~/ws/manager";

// ── inlined from deleted useGameListQuery ──

function buildListQueryFromFilters(
  filters: Partial<ListGamesQuery>,
  options?: { offset?: number; limit?: number; sortBy?: string; sortOrder?: string },
): ListGamesQuery {
  const q = {} as Record<string, string>;
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === "") continue;
    q[k] = String(v);
  }
  if (options?.offset != null) q.offset = String(options.offset);
  if (options?.limit != null) q.limit = String(options.limit);
  if (options?.sortBy) q.sortBy = options.sortBy;
  if (options?.sortOrder) q.sortOrder = options.sortOrder;
  return q as unknown as ListGamesQuery;
}

// ── helpers ──

const DEFAULT_DOMAIN = "lobby-games" as const;
const DEFAULT_QUERY_KEY_PREFIX = "games" as const;
const DEFAULT_MESSAGE_TYPES = {
  list: SharedLobbyServerMessageType.LIST,
  created: SharedLobbyServerMessageType.CREATED,
  updated: SharedLobbyServerMessageType.UPDATED,
  deleted: SharedLobbyServerMessageType.DELETED,
} as const;
const DEFAULT_EXTRACT_ID = (p: unknown) => (p as { id: string })?.id ?? "";
const DEFAULT_EXTRACT_DELETE_ID = (p: unknown) => (p as { gameId: string })?.gameId ?? "";

export { DEFAULT_DOMAIN, DEFAULT_QUERY_KEY_PREFIX, DEFAULT_MESSAGE_TYPES };

function stableStringify(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

interface MessageTypes {
  list: string;
  created: string;
  updated: string;
  deleted: string;
}

interface UseLobbyRealtimeOptions {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  /** TanStack Query key prefix. Default: "games" */
  queryKeyPrefix?: string;
  /** WS domain name. Default: "lobby-games" */
  domain?: string;
  /** Server message type strings. Default uses shared LobbyServerMessageType values */
  messageTypes?: MessageTypes;
  /** Extract room/game id from CREATED/UPDATED payload. Default: (p) => p.id */
  extractId?: (payload: unknown) => string;
  /** Extract room/game id from DELETED payload. Default: (p) => p.gameId */
  extractDeleteId?: (payload: unknown) => string;
}

/**
 * Subscribe to a lobby WS domain and keep a TanStack Query cache in sync
 * with server-side room create/update/delete events.
 *
 * Game-agnostic: configure queryKeyPrefix, domain, and messageTypes per game.
 *
 * @example generale (defaults)
 *   useLobbyRealtime(() => filters(), { offset, limit });
 *
 * @example bomberman
 *   useLobbyRealtime(() => buildFilterRecord(filter()), {
 *     queryKeyPrefix: "bomberman-rooms",
 *     domain: "lobby-bomberman",
 *     messageTypes: { list: "LOBBY_LIST", created: "LOBBY_CREATED", updated: "LOBBY_UPDATED", deleted: "LOBBY_DELETED" },
 *     extractId: (p) => (p as RoomSummary).gameId,
 *     extractDeleteId: (p) => (p as { id: string }).id,
 *   });
 */
export function useLobbyRealtime(filtersAccessor: () => Partial<ListGamesQuery>, options?: UseLobbyRealtimeOptions) {
  const qc = useQueryClient();
  const wsMgr = useWS();
  const prefix = options?.queryKeyPrefix ?? DEFAULT_QUERY_KEY_PREFIX;
  const domain = options?.domain ?? DEFAULT_DOMAIN;
  const MT = options?.messageTypes ?? DEFAULT_MESSAGE_TYPES;
  const extractId = options?.extractId ?? DEFAULT_EXTRACT_ID;
  const extractDeleteId = options?.extractDeleteId ?? DEFAULT_EXTRACT_DELETE_ID;

  // ensure underlying ws is connected (provider is created with autoConnect=false)
  if (!wsMgr.isConnected) {
    try {
      wsMgr.connect(true);
    } catch (err) {
      console.warn("[useLobbyRealtime] wsMgr.connect failed", err);
    }
  }

  // reactive view of the server-shaped filters (strings + pagination/sort)
  const serverFilters = createMemo<ListGamesQuery>(() =>
    buildListQueryFromFilters(filtersAccessor(), {
      offset: options?.offset,
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    }),
  );

  const sub = useSubConnector<LobbyClientEvent, LobbyMessage, { filters?: ListGamesQuery } & WSOpenPayloadBase>(
    domain,
    { autoOpen: true, context: { filters: serverFilters() } as { filters?: ListGamesQuery } & WSOpenPayloadBase },
  );

  // queryKey shape: [prefix, filtersAccessor(), offset, limit, sortBy, sortOrder]
  function isGameQueryKey(queryKey: unknown): queryKey is unknown[] {
    return Array.isArray(queryKey) && queryKey[0] === prefix;
  }

  function queryKeyMatchesCurrentFilters(queryKey: unknown[]) {
    return stableStringify(queryKey[1] ?? {}) === stableStringify(filtersAccessor());
  }

  function getMatchingQueries() {
    return qc
      .getQueryCache()
      .getAll()
      .filter((q) => isGameQueryKey(q.queryKey) && queryKeyMatchesCurrentFilters(q.queryKey as unknown[]));
  }

  let patchFailureTimer: number | undefined;
  function safeInvalidateAllDebounced() {
    if (patchFailureTimer) window.clearTimeout(patchFailureTimer);
    patchFailureTimer = window.setTimeout(() => {
      qc.invalidateQueries({ predicate: (q) => isGameQueryKey(q.queryKey) });
      patchFailureTimer = undefined;
    }, 120);
  }

  function applyListSnapshotToCache(list: unknown[]) {
    for (const q of getMatchingQueries()) {
      qc.setQueryData(q.queryKey, () => list);
    }
  }

  function patchCreated(payload: unknown) {
    const id = extractId(payload);
    if (!id) return;
    const queries = getMatchingQueries();
    let patched = false;
    for (const q of queries) {
      const data = qc.getQueryData(q.queryKey) as Array<{ id: string; gameId?: string }> | undefined;
      if (!Array.isArray(data)) continue;
      if (data.some((d) => extractId(d as unknown) === id)) {
        patched = true;
        continue;
      }
      qc.setQueryData(q.queryKey, [payload as (typeof data)[number], ...data]);
      patched = true;
    }
    if (!patched) safeInvalidateAllDebounced();
  }

  function patchUpdated(payload: unknown) {
    const id = extractId(payload);
    if (!id) return;
    const queries = getMatchingQueries();
    let patched = false;
    for (const q of queries) {
      const data = qc.getQueryData(q.queryKey) as Array<{ id: string; gameId?: string }> | undefined;
      if (!Array.isArray(data)) continue;
      const idx = data.findIndex((d) => extractId(d as unknown) === id);
      if (idx < 0) continue;
      const next = [...data];
      next[idx] = payload as (typeof data)[number];
      qc.setQueryData(q.queryKey, next);
      patched = true;
    }
    if (!patched) safeInvalidateAllDebounced();
  }

  function patchDeleted(payload: unknown) {
    const gameId = extractDeleteId(payload);
    if (!gameId) return;
    const queries = getMatchingQueries();
    let patched = false;
    for (const q of queries) {
      const data = qc.getQueryData(q.queryKey) as Array<{ id: string; gameId?: string }> | undefined;
      if (!Array.isArray(data)) continue;
      const next = data.filter((d) => {
        const did = extractId(d as unknown);
        return did !== gameId;
      });
      if (next.length === data.length) continue;
      qc.setQueryData(q.queryKey, next);
      patched = true;
    }
    if (!patched) safeInvalidateAllDebounced();
  }

  // Accept both typed LobbyMessage and raw { type, payload } from game-specific servers
  function handleServerMessage(msg: { type: string; payload: unknown }) {
    try {
      switch (msg.type) {
        case MT.list:
          applyListSnapshotToCache(msg.payload as unknown[]);
          break;
        case MT.created:
          patchCreated(msg.payload);
          break;
        case MT.updated:
          patchUpdated(msg.payload);
          break;
        case MT.deleted:
          patchDeleted(msg.payload);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("[useLobbyRealtime] handleServerMessage error", err);
      safeInvalidateAllDebounced();
    }
  }

  sub.onOpen(() => {
    // server emits an initial snapshot on open; explicitly request one as a safety belt
    // so the client always receives a list matching its current filters.
    sub.send({
      type: LobbyClientEventType.REQUEST_LIST,
      payload: {
        filters: serverFilters(),
        offset: options?.offset,
        limit: options?.limit,
      },
    });
  });

  sub.onMessage((msg) => {
    if (!msg) return;
    handleServerMessage(msg as LobbyMessage);
  });

  // when filters change, push set-filters so server-side push events use the new filters
  createEffect(
    on(
      serverFilters,
      (filters) => {
        if (!sub.ready) return;
        sub.send({
          type: LobbyClientEventType.SET_FILTERS,
          payload: { filters },
        });
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    try {
      sub.close();
    } catch {
      /* ignore */
    }
    if (patchFailureTimer) {
      window.clearTimeout(patchFailureTimer);
      patchFailureTimer = undefined;
    }
  });

  return sub;
}
