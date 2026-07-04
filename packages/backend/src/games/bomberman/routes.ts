import { type Elysia, t } from "elysia";
import { BombermanManager } from "./service/BombermanManager";
import { authPlugin } from "../../middleware/authPlugin";
import { userService } from "../../services/userService";
import { sessionService } from "../../services/sessionService";
import { cookieScheme } from "../../routes/user";

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
        const service = bombermanManager.createGame(body.roomName, userId, creatorName);
        return { success: true, data: { gameId: service.gameId } };
      },
      { body: t.Object({ roomName: t.String(), password: t.Optional(t.String()) }), cookie: cookieScheme },
    )
    .get("/room/list", ({ cookie, set }) => {
      const userId = getUserIdFromCookie(cookie);
      if (!userId) {
        set.status = 401;
        return { success: false, error: "Please log in first" };
      }
      return { success: true, data: bombermanManager.getRoomListSummary() };
    })
    .get("/room/connect/:gameId", ({ params, cookie, set }) => {
      const userId = getUserIdFromCookie(cookie);
      if (!userId) {
        set.status = 401;
        return { success: false, error: "Please log in first" };
      }
      const service = bombermanManager.getGame(params.gameId);
      if (!service) return { success: false, message: "Game not found" };
      return service.prepConnectionForPlayer(userId);
    });
}
