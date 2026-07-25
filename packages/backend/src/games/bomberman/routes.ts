import { type Elysia, t } from "elysia";
import { BombermanManager } from "./service/BombermanManager";
import { authPlugin } from "../../middleware/authPlugin";
import { userService } from "../../services/userService";
import { sessionService } from "../../services/sessionService";
import { cookieScheme } from "../../routes/user";
import { bombermanReplayService } from "../../services/bombermanReplayService";

export const bombermanManager = new BombermanManager();

function getUserIdFromCookie(cookie: Record<string, unknown>): string | null {
  const sid = (cookie["sid"] as { value?: string } | undefined)?.value;
  if (!sid) return null;
  const session = sessionService.get(sid);
  return session?.userId ?? null;
}

export function bombermanRoutes(app: Elysia) {
  return app
    .use(authPlugin)
    .post(
      "/room/create",
      async ({ body, cookie, set }) => {
        const userId = getUserIdFromCookie(cookie);
        if (!userId) {
          set.status = 401;
          return { success: false, error: "Please log in first" };
        }
        const user = await userService.findById(userId);
        const creatorName = user?.username ?? "Unknown";
        const service = bombermanManager.createGame(body.roomName, userId, creatorName, body.password, body.config);
        return { success: true, data: { gameId: service.gameId } };
      },
      {
        body: t.Object({
          roomName: t.String(),
          password: t.Optional(t.String()),
          config: t.Optional(t.Record(t.String(), t.Any())),
        }),
        cookie: cookieScheme,
      },
    )
    .get("/room/list", ({ cookie, set }) => {
      const userId = getUserIdFromCookie(cookie);
      if (!userId) {
        set.status = 401;
        return { success: false, error: "Please log in first" };
      }
      return { success: true, data: bombermanManager.getRoomListSummary() };
    })
    .get("/room/connect/:gameId", ({ params, query, cookie, set }) => {
      const userId = getUserIdFromCookie(cookie);
      if (!userId) {
        set.status = 401;
        return { success: false, error: "Please log in first" };
      }
      const service = bombermanManager.getGame(params.gameId);
      if (!service) return { success: false, message: "Game not found" };
      const role = query["role"] === "spectator" ? "spectator" : "player";
      return service.prepConnectionForPlayer(userId, role);
    })
    .get("/replays", ({ query, cookie, set }) => {
      const userId = getUserIdFromCookie(cookie);
      if (!userId) {
        set.status = 401;
        return { success: false, error: "Please log in first" };
      }
      const limit = Math.max(1, Math.min(50, Number(query["limit"]) || 20));
      const offset = Math.max(0, Number(query["offset"]) || 0);
      const data = bombermanReplayService.listForUser(userId, limit, offset);
      return { success: true, data };
    })
    .get("/replays/:id", ({ params, cookie, set }) => {
      const userId = getUserIdFromCookie(cookie);
      if (!userId) {
        set.status = 401;
        return { success: false, error: "Please log in first" };
      }
      try {
        const data = bombermanReplayService.getForUser(userId, params.id);
        if (!data) {
          set.status = 404;
          return { success: false, error: "REPLAY_NOT_FOUND" };
        }
        return { success: true, data };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (message === "REPLAY_CORRUPT") {
          set.status = 500;
          return { success: false, error: "REPLAY_CORRUPT" };
        }
        set.status = 500;
        return { success: false, error: "INTERNAL_ERROR" };
      }
    });
}
