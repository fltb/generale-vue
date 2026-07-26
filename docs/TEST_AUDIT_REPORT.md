# 测试套件审计报告

> 状态：**已完成**。本报告替换先前的“审计交接记录”，只记录已实际执行并取得真实输出的结果。
> 完成日期：2026-07-26。执行环境：Bun 1.3.14、Node v24.18.0（经 fnm；系统 Node 20.19.0 不满足 depcruise `^22||^24||>=26` 要求）、Vitest 3.2.4、Playwright（Chromium，headless）。

## 审计范围与口径

- 范围：`packages/backend`、`packages/frontend`、`packages/bomberman-engine`、`packages/i18n`、`e2e` 全部测试与测试支撑代码，外加根 workspace 质量门与运行时冒烟。
- 处置口径：`KEEP` / `FIX` / `MERGE` / `DELETE`。
- 依赖标签口径:`REAL` / `MOCK` / `FAKE` / `TIME` / `NETWORK`;fake WebSocket / mock Drizzle / 假 SMTP 一律不得标为 REAL。
- 验收标准：所有 runner 退出码为 0；e2e 两次运行（单次 + `--repeat-each=2`）全绿且**首次尝试即通过**（零 retry）。

## 测试文件 manifest（初始 → 最终）

| 包 | 初始 | 最终 | 差值 | 原因 |
|---|---|---|---|---|
| backend | 41 | 37 | −4 | 删除 `debug9.test.ts`、`websocket.{basic,functional,realtime}.test.ts`（前期已提交，本次核验确认） |
| frontend | 104 | 100 | −4 | 删除 MapTile、`routes/test.test.tsx`、Bomberman `role-room-entry`、`bomberman-sync-protocol`（前期已提交，本次核验确认） |
| bomberman-engine | 2 | 2 | 0 | 无变化 |
| i18n | 1 | 1 | 0 | 无变化 |
| e2e | 10 | 8 | −2 | 删除 `kick-host.test.ts`（MERGE 进 room-management）、`in-game-interaction.test.ts`（依赖已删除的 bridge 方法，契约已被 game-flow 覆盖） |
| **合计** | **158** | **148** | **−10** | |

backend 37 = 32 个 vitest 单元文件 + 5 个 bun:test 集成文件（`helpers/integration.test.ts`、`routes/{auth,game,map,settings}.integration.test.ts`）。
另删除非测试脚本 `packages/backend/scripts/testEmail.ts`（前期已提交）。

## 按包的测试处置清单

未在下表列出的文件均为 `KEEP`（契约唯一、有明确 runner 与依赖边界）。

### backend（前期已提交，本次重新执行验证）

| 文件 | 处置 | 理由 |
|---|---|---|
| `src/debug9.test.ts` | DELETE | 调试残留，无契约 |
| `src/plugins/__tests__/websocket.{basic,functional,realtime}.test.ts` | DELETE | 与保留的 3 个 canonical websocket suite 重复 |
| `src/plugins/__tests__/websocket.{unit,domain-handlers,multi-dev-reconnection}.test.ts` | KEEP | canonical WebSocket 契约（33 pass） |
| `src/__tests__/`（5 个集成文件） | KEEP | 每例 mkdtemp 临时 SQLite + 真实 drizzle migrations |

本次会话新增修复：`src/services/emailService.ts` 补上 `EMAIL_METHOD=none` 分支（nodemailer `jsonTransport`，不触网）。该开关在 AGENTS.md 与 e2e runner 中早已使用但后端从未实现——此缺失导致 e2e 注册旅程在假 SMTP 上挂起超时。

### frontend（前期已提交 + 本次会话修复）

| 文件 | 处置 | 理由 |
|---|---|---|
| MapTile、`routes/test.test.tsx`、`role-room-entry`、`bomberman-sync-protocol` 测试 | DELETE | 无效/重复契约（前期已提交） |
| `vitest.config.ts` | FIX | 缺少 `@generale/types`、`@generale/bomberman-engine` workspace alias，导致整包测试无法解析依赖 |
| `tsconfig.json` | FIX | 补 paths 映射，使 `tsc --noEmit` 与 vitest 解析一致 |
| `src/routes/games/bomberman/api/__tests__/replays.test.ts` | FIX | fetch mock 从模块作用域移入 `beforeEach`（happy-dom 初始化顺序问题） |
| `src/routes/games/generale/components/__tests__/roomlist/index.test.tsx` | FIX | 断言更新为 `/generale/room/g1` ——原断言钉住的是一个真实产品 bug（见下） |

**测试驱动发现的产品 bug（本次会话修复于源头）：**
1. `CreateRoomModal.tsx` 与 `roomlist/index.tsx` 在多游戏平台重构后仍导航到已不存在的 `/game/:id` 路由（命中 404 catch-all）——创建/加入 Generale 房间在产品中实际不可用。已改为 `/generale/room/:id`，并在 dev 冒烟中真机验证。
2. `src/ws/manager.ts` 没有 pong 看门狗：静默断网（无 TCP FIN）时客户端永远检测不到连接死亡。已加入「连续 2 次 ping 无 pong（约 10-15s）→ 主动废弃 socket → 走既有 `reconnecting` + 退避重连路径」；`onclose` 与看门狗共用提取出的 `_handleSocketDown()`。
3. `packages/i18n/package.json` 存在尾随逗号（Bun 容忍 JSONC，rspack 严格 JSON 解析失败），导致 rsbuild 构建失败。已移除。
4. `packages/bomberman-engine` 的 `dist/` 从未构建（exports 指向 `./dist/index.js`），且根 `node_modules` 缺少其 workspace 链接——backend 运行时无法解析该包。已 `bun install` 重链 + 构建（构建前需先重建 `@generale/types` dist）。

### bomberman-engine

2 文件（`determinism.test.ts`、`replay.test.ts`）KEEP；18 tests pass（446ms）。本次会话顺带修复其 `src/game.ts`、`src/map-gen.ts` 对新版 `@generale/types` 的过期 import（frontend typecheck 曾因此失败）。

### i18n

`src/__tests__/createT.test.ts` KEEP：5 个契约（en、zh-CN、单参数、多参数、全局缺失 key）。已确认根 `bun run test` 的 `--filter=./packages/*` **确实执行** i18n（输出含 `@generale/i18n test: Tests 5 passed`），交接遗留疑问关闭，无需 fallback 串联。

### e2e（本次会话完成）

基础设施（全部新建/改造）：
- `e2e/src/global.d.ts`（新建）：与 `packages/frontend/src/global.d.ts` 逐字段对齐的 5 成员 `window.__test__` 独立声明（两 TS 项目不互通）。
- `e2e/src/process.ts`（新建）：`stopProcess()` —— SIGTERM → 等真实 exit → 超时升级 SIGKILL → 仍等真实 exit；替换 backend.ts（3 处）/frontend.ts（2 处）原「kill + 固定 timeout 必然 resolve」模式。两次全量运行后 `ps` 均确认 **无残留子进程**。
- `e2e/src/testScenario.ts`：构造函数接受 Playwright `TestInfo`；新增绑定字段 `outputPath = (name) => testInfo.outputPath(name)`，截图 artifact 按 test 隔离。
- `e2e/src/bombermanSession.ts`：第 4 个构造参数注入 `outputPath`；6 处失败路径截图不再写死 `e2e/screenshots/`；公开 `screenshot()` 方法删除。
- `e2e/src/playerSession.ts`：删除 3 个引用已废除 bridge 字段的方法（`clickTile`/`getTileOwner`/`waitForTileOwner`）；新增 `waitForConnectionState()`；`createRoom`/`getRoomId` 的路由从 `/`、`/game/` 修正为 `/generale`、`/generale/room/`。

spec 处置：

| 文件 | 处置 | 理由 |
|---|---|---|
| `kick-host.test.ts` | DELETE(MERGE) | 「转移后新 host 可踢人」授权链并入 room-management 第一个 test |
| `in-game-interaction.test.ts` | DELETE | 依赖已删除的 `clickTile`；投降/终局契约由 game-flow 独立覆盖 |
| `room-management.test.ts` | MERGE+FIX | 第一 test 合并授权链（以 start-game 按钮消失为确定性信号，无固定 sleep）；第二 test 原样保留；URL 修正 |
| `disconnection.test.ts` | FIX | 弃用 `(mgr as any).close()` 私有接口，改 `context().setOffline(true/false)` 真实断网，断言 reconnecting → connected → PLAYING；e2e 内 `as any` 清零 |
| `registration-flow.test.ts` | FIX | 中文选择器（`去注册`/`用户名`/`邮箱`/`密码`）更新为现英文 UI；补勾选条款 checkbox（不勾则提交按钮 disabled） |
| `chat-scenario.test.ts` / `game-flow.test.ts` | FIX | 房间 URL、`TestScenario(testInfo)` 接线 |
| `bomberman-map-team.test.ts` | FIX+DELETE | 第二个纯 `fetch()` test 删除——与 backend `map.integration.test.ts` 的 `POST then GET /maps/detail/:id — preserves a Bomberman map` 完全同契约；`generateBombermanTiles()` 随之删除；doc 注释改指 backend 契约名；4 处成功路径截图删除 |
| `bomberman-series.test.ts` | FIX | 9 处成功路径截图删除；ctor/beforeEach 接线 |
| `bomberman-spectate-replay.test.ts` | FIX | 5 处成功路径截图删除；ctor/beforeEach 接线 |

## 依赖标签统计（按 suite 类别）

| Suite | 标签 | 说明 |
|---|---|---|
| backend vitest（32 文件/481 tests） | FAKE + MOCK + TIME | `vitest.setup.ts` 整体 mock `drizzle-orm/bun-sqlite`；WebSocket 用 fake 对象；nodemailer mock；无真实 DB/网络 |
| backend bun:test（5 文件/38 tests） | REAL | 每例临时 SQLite 文件库 + 真实 drizzle migrations + 真实 Elysia 路由 |
| frontend vitest（100 文件/600 tests） | FAKE + MOCK + TIME | happy-dom、FakeWebSocket、fetch mock、fake timers |
| bomberman-engine（2 文件/18 tests） | REAL(纯函数) | 确定性引擎，无外部依赖，固定 seed |
| i18n（1 文件/5 tests） | REAL | 直接加载真实 locale JSON |
| e2e（8 spec/9 tests） | REAL + NETWORK | 真实 backend 子进程 + rsbuild dev + Chromium；断网用 `setOffline` 模拟 NETWORK 边界 |

## Coverage 结果

`vitest run --coverage`（v8），两包退出码均 0：

| 包 | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| backend | 51.94% | 71.99% | 64.62% | 51.94% |
| frontend | 55.61% | 80.93% | 65.20% | 55.61% |

Bomberman 专属阈值（`src/routes/games/bomberman/**`：lines 20 / branches 10 / functions 10 / statements 20）达标（coverage 运行退出码 0，未触发阈值失败）。

## e2e 旅程清单与执行结果

8 条旅程（Chromium-only，workers=1，retries=1 仅作保险丝）：

1. registration-flow — 注册新用户 + seeded 用户登录建房
2. game-flow — 4 人登录 → 建房 → ready → 开局 → 连环投降 → 终局
3. chat-scenario — 双人房间聊天互发
4. room-management — host 转移改变权限（新 host 踢人）；host 直接踢人
5. disconnection — 游戏中真实断网 → reconnecting → 恢复 → PLAYING
6. bomberman-series — BO3 轮转投降、比分、冠军、回大厅
7. bomberman-spectate-replay — 观战 + 终局 replay API
8. bomberman-map-team — 团队模式 UI 全流程

执行记录（最终代码状态下）：
- `bun run test:e2e`：**9 passed (1.9m)**，退出码 0，输出中无任何 `retry`/`flaky`，全部首次尝试通过。
- `bun run --cwd e2e test -- --repeat-each=2`：**18 passed (3.3m)**，退出码 0，零 retry。
- 两次运行后 `ps aux | grep -E "rsbuild|bun run src/index"` 均为空（`stopProcess` 生效，无僵尸进程）。

## 质量门结果

| 命令 | 退出码 | 备注 |
|---|---|---|
| `bun run typecheck` | 0 | 5 包 + e2e 全部 0 |
| `bun run test` | 0 | i18n 5、engine 18、backend 481(vitest)+38(bun:test)、frontend 600，全部通过 |
| `bun run ci:lint` | 0 | biome ci，0 error 0 warning |
| `bun run check:conventions` | 0* | *工作树含用户未跟踪草稿 `packages/frontend/src/routes/games/bomberman/api/lobbyApi.ts` 时为 1（forbidden import 唯一来源即该文件）；将其移出后运行为 0。该草稿属本审计范围外，未删除、未修改 |
| `bun run check:architecture` | 0 | 需 Node ≥22（fnm use 24）；`✔ no dependency violations (367 modules, 526 dependencies)` |
| `bun run arch` | 0 | 需 Node ≥22；ts-archunit 报告中唯一非基线新增重复函数体同样指向上述范围外草稿 |

## 运行时冒烟（bun run dev）

真实 dev 服务（backend :3000 + rsbuild :5173，`EMAIL_METHOD=none`，seed 4 用户）+ headless Chromium 实测：

- test-alice 登录 → `/generale` 大厅 → 建房 → **成功导航到 `/generale/room/game_1785076266266`**（验证 CreateRoomModal 导航修复在真机生效）；
- test-bob 登录 → 直接进房 URL → 出现在 Player List → Ready；
- alice Start Game → 游戏进入 **In Game / Tick 26**（DOM 断言）→ 游戏结束回到房间视图；
- Surrender 按钮触发原生 `confirm("确定投降吗？")` —— 完整「投降 → game-end-overlay」契约由 e2e game-flow spec 覆盖（两次运行首试通过）；
- 结束后 `hub stop` 关闭两个 dev 服务，无残留进程。

注：生产模式下 `window.__test__` bridge 确认不存在（未带 `?__test__=1` 时 `typeof window.__test__ === "undefined"`），bridge 门控正确。

## 已知限制

1. **范围外草稿**：未跟踪文件 `bomberman/api/lobbyApi.ts`（与 `api/rooms.ts` 重复实现、无引用）是 `check:conventions` 非零与 ts-archunit 报告项的唯一来源；处理与否由用户决定。
2. **Node 版本**：`check:architecture` / `arch` 需 Node ≥22（本机经 `fnm use 24`）；系统默认 Node 20.19.0 会直接失败。
3. **zh-CN locale** 有 4 个未翻译 key（值为英文原文，L72/392/504/526）——内容翻译问题，不在测试审计范围。
4. **coverage 绝对值**（backend lines ~52%、routes/中间件多为 0%）反映单元层大量 mock 化 + 路由契约主要由 bun:test 集成与 e2e 覆盖（这两层不计入 vitest coverage）。
5. **冒烟测试中的多标签页**：同一浏览器 profile 的多个标签共享 localStorage 会话（后登录者覆盖先登录者）——e2e 使用相互隔离的 browser context，正是正确做法。
6. SMTP 真实外发不进入任何确定性测试（`EMAIL_METHOD=none` 已在后端实现）。
7. e2e 保持独立 `test:e2e`，未纳入根 `test` 或 CI 快速门。
