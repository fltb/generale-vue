/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ─── Layer 1: Cross-package boundaries ───
    {
      name: "frontend-no-backend-internals",
      comment: "Frontend must not import backend code (only shared types)",
      severity: "error",
      from: { path: "^packages/frontend/" },
      to: { path: "^packages/backend/", pathNot: "^packages/backend/.*\\.d\\.ts$" },
    },
    {
      name: "backend-no-frontend",
      comment: "Backend must not import frontend code",
      severity: "error",
      from: { path: "^packages/backend/" },
      to: { path: "^packages/frontend/" },
    },

    // ─── Layer 2: Frontend arch — routes use domain hooks, not raw infra ───
    {
      name: "bomberman-routes-no-raw-sync",
      comment:
        "Bomberman route files must not import useSyncedState/useVersionedOptimisticState directly. Use the domain hooks (useBombermanRoomSession/useBombermanGameSession) instead.",
      severity: "error",
      from: {
        path: "^packages/frontend/src/routes/games/bomberman/(?!hooks/)",
      },
      to: {
        path: "^packages/frontend/src/hooks/use(SyncedState|VersionedOptimisticState)\\.tsx$",
      },
    },
    {
      name: "generale-routes-no-raw-sync",
      comment:
        "Generale route files must not import useSyncedState/useVersionedOptimisticState directly. Use domain hooks instead.",
      severity: "error",
      from: {
        path: "^packages/frontend/src/routes/games/generale/(?!hooks/)",
      },
      to: {
        path: "^packages/frontend/src/hooks/use(SyncedState|VersionedOptimisticState)\\.tsx$",
      },
    },

    // ─── Layer 3: Frontend — components don't import WS directly ───
    {
      name: "components-no-direct-ws",
      comment: "Components must go through hooks, not import WS manager directly",
      severity: "warn",
      from: { path: "^packages/frontend/src/(components|ui)/" },
      to: { path: "^packages/frontend/src/ws/manager" },
    },

    // ─── Layer 4: Backend — game service isolation ───
    {
      name: "backend-games-no-direct-db",
      comment: "Game domain modules must use service layer for DB access",
      severity: "warn",
      from: { path: "^packages/backend/src/games/" },
      to: { path: "^packages/backend/src/db/" },
    },

    // ─── Layer 5: Circular deps between game domains ───
    {
      name: "no-cross-game-imports",
      comment: "Game domains must not import from each other",
      severity: "error",
      from: { path: "^packages/backend/src/games/([^/]+)/" },
      to: {
        path: "^packages/backend/src/games/([^/]+)/",
        pathNot: "^packages/backend/src/games/$1/",
      },
    },
    {
      name: "no-cross-game-imports-frontend",
      comment: "Frontend game routes must not import from other games",
      severity: "error",
      from: { path: "^packages/frontend/src/routes/games/([^/]+)/" },
      to: {
        path: "^packages/frontend/src/routes/games/([^/]+)/",
        pathNot: "^packages/frontend/src/routes/games/$1/",
      },
    },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },
    combinedDependencies: true,
    includeOnly: "^packages/",
  },
};
