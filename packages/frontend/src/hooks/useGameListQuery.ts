/**
 * useGameListQuery.ts
 *
 * 通用 hook：把前端 filters → API call，使用 TanStack Solid Query（useQuery）。
 * 游戏无关 —— queryFn 由调用方注入，bomberman / generale 等都能复用。
 */

import { useQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

/** 将前端 filters（string | undefined 值）转换为 query params 对象 */
export function buildListQueryFromFilters(
  filters: Record<string, string | undefined>,
  opts?: { offset?: number; limit?: number; sortBy?: string; sortOrder?: string },
): Record<string, string> {
  const q: Record<string, string> = {};

  for (const key of Object.keys(filters)) {
    const v = filters[key];
    if (v === undefined || v === null || v === "") continue;
    q[key] = String(v);
  }

  if (opts?.offset !== undefined) q.offset = String(opts.offset);
  if (opts?.limit !== undefined) q.limit = String(opts.limit ?? 50);
  if (opts?.sortBy) q.sortBy = opts.sortBy;
  if (opts?.sortOrder) q.sortOrder = opts.sortOrder;

  return q;
}

/**
 * useGameListQuery
 *
 * @param queryKey   - TanStack Query key prefix（如 "games" 或 "bomberman-rooms"）
 * @param filtersAccessor - Solid Accessor 返回当前 filters
 * @param queryFn    - 后端请求函数，接收 query params 对象，返回 data
 * @param options    - 可选: offset/limit/sortBy/sortOrder
 */
export function useGameListQuery<TData>(
  queryKey: string,
  filtersAccessor: Accessor<Record<string, string | undefined>>,
  queryFn: (params: Record<string, string>) => Promise<TData>,
  options?: { offset?: number; limit?: number; sortBy?: string; sortOrder?: string },
) {
  return useQuery(() => ({
    queryKey: [
      queryKey,
      filtersAccessor(),
      options?.offset ?? 0,
      options?.limit ?? 50,
      options?.sortBy,
      options?.sortOrder,
    ],
    queryFn: async () => {
      const q = buildListQueryFromFilters(filtersAccessor(), {
        offset: options?.offset ?? 0,
        limit: options?.limit ?? 50,
        sortBy: options?.sortBy,
        sortOrder: options?.sortOrder,
      });
      return queryFn(q);
    },
    retry: false,
    refetchOnWindowFocus: true,
  }));
}
