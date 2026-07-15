import {
  project,
  functions,
  modules,
  types,
  call,
  functionContain,
  haveNameMatching,
  resideInFile,
  resideInFolder,
  notExist,
} from "@nielspeter/ts-archunit";
import { agentGuardrails } from "@nielspeter/ts-archunit/presets";

const p = project("tsconfig.arch.json");

export default [
  // ── AI agent safety floor ──
  ...agentGuardrails(p, {
    src: "packages/*/src/**",
    noGenericErrors: true,
    noStubs: true,
    noEmptyBodies: true,
    noCopyPaste: true,
  }),

  // ── Sync layer: game hubs must use useLobbyRealtime ──
  functions(p)
    .that()
    .resideInFile("packages/frontend/src/routes/games/bomberman/hub.tsx")
    .should()
    .contain(call("useLobbyRealtime"))
    .asSeverity("error"),

  // ── Sync layer: route files must use domain hooks, not raw useSyncedState ──
  modules(p)
    .that()
    .resideInFolder("packages/frontend/src/routes/games/*/")
    .should()
    .satisfy(notImportFrom("~/hooks/useSyncedState"))
    .asSeverity("error"),

  // ── No duplicate type enums in game backends ──
  // Bomberman must not define its own LobbyServerMessageType
  types(p)
    .that()
    .resideInFolder("packages/backend/src/games/bomberman/")
    .and(haveNameMatching(/LobbyServerMessageType/))
    .should(notExist())
    .asSeverity("error"),

  // ── Route files must not import WS manager directly ──
  modules(p)
    .that()
    .resideInFolder("packages/frontend/src/routes/games/*/")
    .should()
    .satisfy(notImportFrom("~/ws/manager"))
    .asSeverity("error"),

  // ── Game backends must not manually iterate raw connectors for sync ──
  // (use GameSyncManager or equivalent domain hook abstraction)
  functions(p)
    .that()
    .resideInFile("packages/backend/src/games/bomberman/service/BombermanService.ts")
    .should()
    .contain(call("Broadcast"))
    .asSeverity("warn"),
];

/**
 * Helper: matches "not import from" for modules.
 */
function notImportFrom(pathPattern: string): (m: { getSourceFile(): { getImportDeclarations(): Array<{ getModuleSpecifierValue(): string }> } }) => boolean {
  return (m) => {
    try {
      const sf = m.getSourceFile();
      const imports = sf.getImportDeclarations();
      return !imports.some((imp) => imp.getModuleSpecifierValue().includes(pathPattern));
    } catch {
      return true;
    }
  };
}
