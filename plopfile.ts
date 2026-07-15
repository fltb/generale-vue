import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function (plop: { setGenerator: (name: string, config: object) => void }) {
  plop.setGenerator("game", {
    description: "Scaffold a new game with proper architecture patterns",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Game identifier (kebab-case, e.g., pacman):",
        validate: (v: string) => (v ? true : "name is required"),
      },
    ],
    actions: [
      {
        type: "add",
        path: "packages/frontend/src/routes/games/{{name}}/hub.tsx",
        templateFile: join(__dirname, "templates/game/frontend/hub.tsx.hbs"),
      },
      {
        type: "add",
        path: "packages/backend/src/games/{{name}}/service/{{pascalCase name}}Service.ts",
        templateFile: join(__dirname, "templates/game/backend/service/Service.ts.hbs"),
      },
    ],
  });
}
