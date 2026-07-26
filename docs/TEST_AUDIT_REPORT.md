# 测试套件审计交接记录

> **状态：用户于 2026-07-26 要求立即停止。本文是可恢复工作的唯一仓库内参考。**
>
> 本文记录实际完成、已验证、正在进行和未开始的事项；未标为“已验证”的内容不得视为完成。原批准计划来自会话资源 `local://test-suite-audit-plan.md`，其完整要求应在恢复前重新读取。

## 目标与判定口径

审计目标：保留的测试必须有唯一、可观察的契约；测试和测试支持代码必须有明确 runner、真实依赖边界和隔离策略；最终应形成完整中文测试审计报告。

测试处置只能使用：`KEEP`、`FIX`、`MERGE`、`DELETE`。依赖标签只能使用：`REAL`、`MOCK`、`FAKE`、`TIME`、`NETWORK`。fake WebSocket/Drizzle/SMTP 不能标为真实集成。

首次扫描实际发现 **158** 个源测试文件（批准计划中的 156 已过时）：backend 41、frontend 104、bomberman-engine 2、i18n 1、e2e 10。临时基线 manifest 已写入：`/tmp/generale-test-audit-manifest.json`；它不在工作树中，恢复时应重新生成并解释计数差异。

已记录运行时版本：Node `v24.1.0`、Bun `1.3.14`、Vitest `3.2.4`、Playwright `1.61.1`。`fnm env` 在当前 shell 输出 `rehash`，执行命令前使用 `rehash() { :; }; eval "$(fnm env)" && fnm use 24` 才能正常激活 Node 24。

## 已完成并验证

### Runner、工作区与全局清理

- 根 `typecheck` 已扩展为 packages workspace 加 `e2e` typecheck。
- backend scripts 已拆为：
  - `test:unit`: `vitest run`
  - `test:integration`: 五个显式 Bun integration 文件、`--isolate --max-concurrency=1`
  - `test`: unit 后 integration
  - `test:watch`: 保持 Vitest watch，且不含 Bun integration。
- i18n 已有 `test` 与 `typecheck` scripts，开发依赖加入 Vitest/TypeScript；`createT.test.ts` 收敛为五个实际契约（English、中文翻译、单参数、多参数、全局缺失 key）。批准计划所称“空 zh-CN fallback”不符合当前 locale 数据：当前 English 的每个 key 都有非空 zh-CN 值，不能伪造 fallback 用例。
- e2e package 已添加 `typecheck` script。
- backend/frontend 已加入 `@vitest/coverage-v8` 3.2.4；frontend coverage include 改为 `src/**/*.{ts,tsx}`，排除测试与 `.d.ts`，Bomberman 阈值保留。
- backend Vitest `afterEach` 清空模块 store、clear mocks、restore spies、unstub globals/env、恢复 real timers；frontend setup 对 DOM cleanup、pending fake timers、real timers、unstub、clear/restore 做清理。
- backend 声明了实际生产 import 所需的 `@generale/i18n` workspace dependency；`bun.lock` 已刷新。
- i18n export 增加 default 条件；Vitest backend/frontend 加 i18n alias。frontend alias 必须保持数组顺序：`@generale/i18n/locales` 必须在 `@generale/i18n` 前。

已验证：

- `bun run --filter=@generale/i18n test && bun run --filter=@generale/i18n typecheck`：5 tests pass、typecheck exit 0。
- backend unit：32 files、481 tests pass。
- backend integration：5 files、38 tests pass；每例 production migration 临时 SQLite。

### Backend 审计

已删除：

- `packages/backend/src/debug9.test.ts`
- `packages/backend/scripts/testEmail.ts`
- `packages/backend/src/plugins/__tests__/websocket.basic.test.ts`
- `packages/backend/src/plugins/__tests__/websocket.functional.test.ts`
- `packages/backend/src/plugins/__tests__/websocket.realtime.test.ts`

已完成的关键变更：

- `src/__tests__/helpers/integration.ts` 使用每例临时 SQLite、production migrations、确定性 seed、环境恢复与递归清理；五个 Bun suite 改为独立 arrange/cleanup。
- map integration 取得 Bomberman 15×13 tiles round-trip 契约；单独 map suite 10 pass。
- workshop map `startGame()` 覆盖转入 `bomberman-service.test.ts`，断言公开 connector snapshot 的 playing 状态与地图维度。
- WebSocket 收敛到 `websocket.unit.test.ts`、`websocket.domain-handlers.test.ts`、`websocket.multi-dev-reconnection.test.ts`；canonical suites 33 pass。
- Generale core fuzz 固定 seed；map generator 调试可视化删除；Bomberman game-sync 重复 confirmedOp 微例删除；bot 的 `Math.random` 边界改为 spy；测试的 mock/instance cleanup 随新的 global cleanup 修复。
- `GameChatInstance` 对未注册 sender 忽略；测试断言不会发出该用户的新消息。

已验证：`bun test packages/backend/src/__tests__/routes/map.integration.test.ts` 10 pass；`bun run --cwd packages/backend test:unit` 32 files/481 pass；`bun run --cwd packages/backend test:integration` 38 pass。integration 注册路径仍会输出 “Email service not initialized” 日志，但用例通过；后续应评估是否需消除该噪音，不能把 SMTP 纳入确定性测试。

## 前端：部分完成，未验收

后台任务在用户停止时被取消。它声称完成或部分完成的修改必须重新审查和重新运行，不能据此标记完成。

已报告的改动包括：

- 删除预定无效测试：MapTile、`routes/test.test.tsx`、Bomberman `role-room-entry`、`bomberman-sync-protocol`；产品 `/test` route 应保留。
- 测试桥已收窄：frontend bridge 只保留 `roomId`、`gameState`、`wsManager`；window bridge 只读暴露 room id、game state、connection state、wait helpers。移除了 tile click、tile owner、viewport、armies、operation queue 等接口。**恢复时必须重新核对 e2e callsites 和 TypeScript 声明。**
- `useBombermanRoomSession` role 传输测试、`useSyncedState` adapter 测试、`replay-controls` UI 测试据报告已重写；`useSyncedState` cleanup 改为拒绝 pending commits、清空 outbox 并关闭 sub。
- 新增 `packages/frontend/src/__tests__/helpers/jsonResponse.ts`；API endpoint tests 迁移到它。`api-base.test.ts` 保留独有 credentials/header/non-JSON/ApiError 契约。
- UI/route/tile theme 多个重复测试已收敛；报告的 focused suites 通过，但没有完成全量 frontend suite 验收。
- 多个 frontend 测试被类型化、timer/`createRoot` cleanup 有局部修复。

恢复时必须完成原计划前端步骤：

1. 用 source/LSP references（若 TS LSP 可用）确认 bridge 净化后的全调用方；不得留兼容字段或空 handler。
2. 对所有删除、role transport、generic sync、replay controls、API helper、DOM 行为、UI matrix、tileTheme、chat/lobby waits、Pixi doubles、timer/root cleanup 逐项复核。
3. 清除保留 frontend tests 与 e2e helpers 中不必要的 `as any`、debug logs、未释放 subscriptions/roots。
4. 在 `packages/frontend` cwd 执行 `bun run test` 和 `bun run typecheck`。当前已知 Vitest 会产生 Solid multiple-instance/disposal 警告；不得把 warning 当作通过依据，也不得掩盖真实 failure。

## E2E：未开始

以下是批准计划的待办，尚未执行：

- 最终只保留八条旅程：registration、game flow、chat、Bomberman BO3、spectate/replay、map/team、disconnection、合并后的 room-management permissions。
- 删除 `kick-host.test.ts` 和 `in-game-interaction.test.ts`；把 host transfer → kick 授权链合并到 `room-management.test.ts`。
- Bomberman map HTTP API 契约应仅在 backend integration，不应留在 e2e。
- 断线必须使用 `page.context().setOffline(true/false)`；bridge 只读 `getConnectionState`，等待 reconnecting 再 connected，并验证同一 room/game 的 PLAYING 状态。
- 新增 `e2e/src/global.d.ts`，精确定义真实读取的 window bridge；spec 不得 `as any`。
- 新增 `e2e/src/process.ts` 的确定性 child process shutdown；controllers 和 `TestScenario.stop()` 必须使用它，artifact 路径从 `TestInfo.outputPath()` 注入。
- 去掉成功路径截图和固定 sleeps；保留失败截图且每 case 使用隔离 artifact path。
- 更新八个 specs 的 `TestScenario(testInfo)` 初始化；保持 Chromium-only、workers 1。执行 `bun run test:e2e` 及 `bun run --cwd e2e test -- --repeat-each=2`，零 retry 才可验收。

## 仍未执行的最终验证与报告要求

以下都未完成，恢复后必须重新实跑并只记录真实输出：

1. `bun run --cwd packages/bomberman-engine test`。
2. 完整 frontend/i18n/backend workspace test，再确认根 `bun run test` 包含 i18n。
3. 两次 e2e 运行及八旅程收集数。
4. coverage：
   - `bun run --cwd packages/backend vitest run --coverage`
   - `bun run --cwd packages/frontend vitest run --coverage`
   记录 lines/branches/functions/statements 和阈值结果。
5. 根质量门：`bun run typecheck`、`bun run test`、`bun run ci:lint`、`bun run check:conventions`、`bun run check:architecture`、`bun run arch`。
6. `bun run dev` runtime smoke：login → create room → join → start → play/surrender → end。
7. 重新生成最终 manifest；目标计划写的是 146 files（backend 36、frontend 99、engine 2、i18n 1、e2e 8），但初始实际是 158 而不是 156，必须逐项解释差异，禁止硬写目标数字。

## 恢复顺序

1. 阅读原批准计划 `local://test-suite-audit-plan.md`（若仍可用）与本交接记录。
2. 先完成并验证 frontend，再完成并验证 e2e；不要在未完成前撰写“通过”的最终报告。
3. 重新跑全部最终验证；最后替换本文为按文件处置、support assets、收集/执行数、coverage、e2e 产物与真实命令时长完整记录的正式报告。

## 明确限制

- 外部真实 SMTP 不进入确定性测试。
- e2e 仍是独立 `test:e2e`，不应擅自纳入根快速 `test` 或 CI。
- 不要提交 coverage HTML/JSON 或 Playwright 原始 artifact。
- 此次停止前没有运行 formatter、lint、architecture、full root test、coverage、dev smoke、浏览器或 e2e；因此这些都不能报告为通过。
