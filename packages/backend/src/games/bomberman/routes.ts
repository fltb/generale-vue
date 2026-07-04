import { type Elysia, t } from "elysia";
import { BombermanManager } from "./service/BombermanManager";
import { authPlugin } from "../../middleware/authPlugin";
import { userService } from "../../services/userService";
import { sessionService } from "../../services/sessionService";
import { cookieScheme } from "../../routes/user";

export const bombermanManager = new BombermanManager();

export function bombermanRoutes(app: Elysia) {
  return app
    .use(authPlugin)
    .post(
      "/room/create",
      async ({ body, cookie: { sid }, set }) => {
        const session = sid?.value ? sessionService.get(sid.value) : undefined;
        if (!session) {
          set.status = 401;
          return { success: false, error: "Please log in first" };
        }
        const user = await userService.findById(session.userId);
        const creatorName = user?.username ?? "Unknown";
        const service = bombermanManager.createGame(body.roomName, session.userId, creatorName);
        return { success: true, data: { gameId: service.gameId } };
      },
      { body: t.Object({ roomName: t.String(), password: t.Optional(t.String()) }), cookie: cookieScheme },
    )
    .get("/room/list", async () => {
      return { success: true, data: [] };
    })
    .get("/room/connect/:gameId", async ({ params }) => {
      const service = bombermanManager.getGame(params.gameId);
      if (!service) return { success: false, message: "Game not found" };
      return {
        success: true,
        data: {
          gameId: params.gameId,
          playerId: "",
          phase: "pregame",
          domains: { primary: `room-${params.gameId}`, chat: `chat-${params.gameId}` },
        },
      };
    });
}
