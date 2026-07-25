import { type Static, t } from "elysia";

// ---- game type ----

export const mapGameTypeSchema = t.Union([t.Literal("generale"), t.Literal("bomberman")]);

// ---- reusable ----

// ---- request schemas ----

export const createMapReqSchema = t.Object({
  gameType: mapGameTypeSchema,
  name: t.String({ minLength: 1, maxLength: 50 }),
  description: t.Optional(t.String({ maxLength: 500 })),
  width: t.Optional(t.Number({ minimum: 10, maximum: 200 })),
  height: t.Optional(t.Number({ minimum: 10, maximum: 200 })),
  data: t.Any(),
  minPlayers: t.Optional(t.Number({ minimum: 0, maximum: 16 })),
  maxPlayers: t.Optional(t.Number({ minimum: 2, maximum: 16 })),
  isPublic: t.Optional(t.Boolean()),
  isDraft: t.Optional(t.Boolean()),
  tags: t.Optional(t.Array(t.String())),
});
export type CreateMapReqBody = Static<typeof createMapReqSchema>;

export const updateMapReqSchema = t.Object({
  gameType: t.Optional(mapGameTypeSchema),
  name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
  description: t.Optional(t.String({ maxLength: 500 })),
  data: t.Optional(t.Any()),
  minPlayers: t.Optional(t.Number({ minimum: 0, maximum: 16 })),
  maxPlayers: t.Optional(t.Number({ minimum: 2, maximum: 16 })),
  isPublic: t.Optional(t.Boolean()),
  isDraft: t.Optional(t.Boolean()),
  tags: t.Optional(t.Array(t.String())),
});
export type UpdateMapReqBody = Static<typeof updateMapReqSchema>;

// ---- response schemas ----

export const mapSumaryRespSchema = t.Object({
  id: t.String(),
  gameType: mapGameTypeSchema,
  name: t.String(),
  description: t.Optional(t.String()),
  authorId: t.String(),
  authorName: t.String(),
  width: t.Number(),
  height: t.Number(),
  minPlayers: t.Number(),
  maxPlayers: t.Number(),
  isPublic: t.Boolean(),
  isDraft: t.Boolean(),
  usageCount: t.Number(),
  tags: t.Array(t.String()),
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String()),
  hasCustomThumbnail: t.Optional(t.Boolean()),
});
export type MapSumaryRespBody = Static<typeof mapSumaryRespSchema>;

export const mapDetailRespSchema = t.Composite([
  mapSumaryRespSchema,
  t.Object({
    data: t.Any(),
    hasDraft: t.Optional(t.Boolean()),
  }),
]);
export type MapDetailRespBody = Static<typeof mapDetailRespSchema>;

export const mapListRespSchema = t.Object({
  success: t.Literal(true),
  data: t.Array(mapSumaryRespSchema),
});
export type MapListRespBody = Static<typeof mapListRespSchema>;

export const mapDetailSuccessRespSchema = t.Object({
  success: t.Literal(true),
  data: mapDetailRespSchema,
});
export type MapDetailSuccessRespBody = Static<typeof mapDetailSuccessRespSchema>;

export const mapCreateSuccessRespSchema = t.Object({
  success: t.Literal(true),
  data: t.Object({
    id: t.String(),
    message: t.String(),
  }),
});
export type MapCreateSuccessRespBody = Static<typeof mapCreateSuccessRespSchema>;

export const mapDeleteSuccessRespSchema = t.Object({
  success: t.Literal(true),
});
export type MapDeleteSuccessRespBody = Static<typeof mapDeleteSuccessRespSchema>;

export const mapErrorRespSchema = t.Object({
  success: t.Literal(false),
  error: t.String(),
});
export type MapErrorRespBody = Static<typeof mapErrorRespSchema>;

// ---- query schemas ----

export const mapListQuerySchema = t.Object({
  offset: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  search: t.Optional(t.String()),
  tags: t.Optional(t.String()),
  minWidth: t.Optional(t.String()),
  maxWidth: t.Optional(t.String()),
  sortBy: t.Optional(t.String()),
});
