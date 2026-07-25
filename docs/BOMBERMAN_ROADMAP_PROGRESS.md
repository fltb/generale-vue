# Bomberman 路线执行报告

更新日期：2026-07-25

## 当前结论

尚未全部写完。已完成确定性共享引擎、权威系列赛生命周期、系列赛前端、战斗反馈、Bot 与单人玩法、队伍模式、观战与回放、地图工坊。部分控制与无障碍、聊天体验已完成。E2E 路径尚未补齐。
## 已完成

### 1. 确定性共享引擎

- 新增 `packages/bomberman-engine`，包名 `@generale/bomberman-engine`。
- 后端旧 `core/game.ts`、`core/map-gen.ts` 已删除；实时后端改为消费共享 engine。
- 引擎提供确定性 Mulberry32 PRNG、初始状态构建、tick、地图生成与校验、事件环、回放 checkpoint/seek。
- `BombermanState` 已包含 RNG 状态、事件序号、事件环和输入指示器；玩家、爆炸和地图定义已扩展共享字段。
- 当前引擎测试：18 项通过。

### 2. 权威系列赛生命周期

- 共享类型增加 `single`、`bo3`、`bo5`、match state、round result、ranking、map source 与 Bot 配置字段。
- 房间 phase 已支持 `between_rounds`。
- 预赛事件已 clean-cutover 为 `ROUND_STARTED`、`ROUND_ENDED`、`MATCH_ENDED`、`START_REJECTED`。
- 服务端根据 `${gameId}:${currentRound}:${currentAttempt}` 的 FNV-1a seed 创建每局。
- 已实现：胜场累计、BO3/BO5 平局重赛、5 秒服务端局间 deadline、最终 ranking、首局输入时间门控。
- 新增 `bomberman-series.test.ts`，覆盖 single、BO3 和 BO5 平局重赛基础语义。

### 3. 系列赛前端

- 建房和房主设置均支持 single、BO3、BO5。
- HUD 展示局号、比分与赛点。
- 局间覆盖层以服务端 `nextRoundStartsAt` 计算倒计时并展示本局结果。
- 最终 Scoreboard 展示冠军、最终比分与逐局结果。
- 新增中英文 i18n key；HUD、Scoreboard、game 前端测试共 21 项通过。


### 4. 战斗反馈

- `EventFeed` 组件实现淘汰事件 feed，展示谁被谁的哪颗炸弹淘汰，以及道具拾取提示。
- `DangerIndicator` 组件显示本地危险警告，低引线炸弹以 2Hz/4Hz 闪烁。
- `DeathOverlay` 组件显示死亡遮罩，含击杀者、投降、缩小等致死原因消息，观战提示。
- 已增加 i18n key；组件集成在游戏 UI 中。

### 5. Bot 与单人玩法

- `decideBombermanBotOperation.ts` 实现完整 bot 决策引擎：避爆寻路、可达区域评估、放弹后逃生、道具目标选择；支持 `easy`、`normal`、`hard` 三种难度层级。
- 困难 bot 识别遥控、踢击、拳击、手套与穿透的风险；bot 尊重队伍模式，不攻击队友。
- `BombermanService` 在 `onBeforeTick` 钩子中注入 bot 操作；bot ID 和随机状态从 FNV-1a seed 确定性派生。
- 后端配置已增加 `botCount`（0-3）和 `botDifficulty`（easy/normal/hard）字段及校验。
- `bomberman-bot.test.ts` 覆盖死玩家、决策间隔、确定性、危险规避、道具拾取、团队意识等 10+ 用例。

### 6. 队伍模式

- 共享类型定义 `teamMode`、`PreGameTeamMode`、`BombermanTeam`、`teamId` 字段。
- `BombermanRoom` 支持 FFA 和 team 两种模式：`CHANGE_TEAM_MODE`/`CHANGE_TEAM` 动作、队伍分配与再平衡、开赛队伍验证。
- `BombermanService` 结算队伍淘汰和系列赛胜场：`getWinner` 返回 `team` 类型，`makeRankings` 按队伍排名。
- `bomberman-team.test.ts` 覆盖 FFA 分配、模式切换、授权、队伍平衡验证和队伍比分等 12+ 用例。
- E2E 场景 `bomberman-map-team.test.ts` 覆盖队伍模式开赛流程（服务恢复后未全量验证）。

### 7. 观战与回放

- `BombermanRoom` 支持纯观战加入/离开，`ENTER_SPECTATE`/`LEAVE_SPECTATE` 动作，观战者列表同步。
- 前端角色感知连接：`role-room-entry.test.tsx` 验证 player/spectator 角色路由。
- 后端 `bombermanReplayService` 完整实现回放录制、gzip 压缩、参与者追踪、90 天过期清理。
- `bombermanReplayService.test.ts` 覆盖录制、追加、完成、列表、详情、过期、丢弃等 10+ 用例。
- 引擎 `createBombermanReplaySession` 提供 checkpoint-based seek/step 回放会话。
- 前端 `BombermanReplays` 列表页、`BombermanReplayPlayer` 播放器（播放/暂停/倍速/时间轴/局内定位）。
- `replay-controls.test.tsx` 验证回放会话 seek/step/版本检测；`replays.test.tsx` 验证 API 调用。
- E2E 场景 `bomberman-spectate-replay.test.ts` 覆盖观战+回放流程（服务恢复后未全量验证）。

### 8. 地图工坊

- 前端 `BombermanMapEditor`、`BombermanMapPreview`、`BombermanMapsList`、`BombermanMapSourcePicker` 组件完整实现编辑、预览、列表、筛选、地图源选择。
- `BombermanMapEditor.test.tsx` 验证地图校验集成（尺寸、密度、生成点、重复、类型）。
- `map-source.test.tsx` 验证程序生成、预制、工坊、轮换四种地图源的选择语义。
- 引擎 `generateBombermanMap`、`validateBombermanMapDefinition` 支持地图生成与校验。
- 后端 `BombermanService.resolveMatchMaps` 支持 procedural/preset/workshop/rotation 四种地图源。
- 预设地图定义 `BOMBERMAN_PRESET_DEFINITIONS`（classic/sparse/dense）及主题清单 `BOMBERMAN_THEME_MANIFEST`（classic/night/high-contrast）。
- 角色皮肤清单 `BOMBERMAN_SKIN_MANIFEST` 含 4 种颜色。
- 导航栏已集成 "Map Workshop" 链接。

### 9. 控制与无障碍

- `KeybindingSettings` 组件支持键盘和手柄键位重映射，含游戏手柄按钮标签。
- `VirtualControls` 组件提供触屏方向/动作虚拟摇杆，含震动反馈支持。
- `BombermanTutorial` 组件展示道具说明和操控指南。
- `VirtualControls.test.tsx`（10 项）、`BombermanTutorial.test.tsx`（1 项）覆盖。
- 主题支持 `high-contrast` 高对比度模式。

### 10. 聊天与体验

- `ChatPanel` 组件支持透明玻璃态模式、跨阶段复用、快捷消息、消息范围过滤（all/game/team/system）。
- `ChatPanel.test.tsx`、`useChat.test.ts` 覆盖连接、断开、消息发送、历史记录、范围过滤。
- 后端 `GameChatInstance` 支持房间/游戏贯穿聊天、小队聊天、系统事件消息、AB 测试快捷消息。
- `EventFeed`、`DangerIndicator`、`DeathOverlay` 组件提供基础战斗反馈。
## 未开始

- 控制台物理手柄（Gamepad API）实际集成。
- 网络延迟、连接状态可视化。
- 暂停 / 主机 ping 规则。
- 角色死亡、游戏结束、道具生成动画与音效反馈。
- 外观商店、道具预设等非竞技系统。
- E2E、截图和最终运行验证。
## 已观察验证

- `bun run --filter=@generale/types build` 通过。
- `bun run --filter=@generale/bomberman-engine typecheck` 通过。
- `bun run --filter=@generale/bomberman-engine test`：18 passed。
- `bun run --filter=@generale/backend typecheck` 通过。
- `bun run --filter=@generale/backend test`：525 passed。
- `bun run --filter=frontend typecheck` 通过。
- `bun run --filter=frontend test`：671 passed。
- 已执行根级 typecheck/test/lint/conventions/architecture/arch；当前 Biome 保留仓库既有 4 条 warning，未发现本轮新增 lint error。

## 风险与后续

系列赛服务端目前仍保留测试直接调用 `startGame()` 的可选参数路径；后续应移除该测试便利路径，确保只由 `BombermanRoom.onGameStart(playerIds, startedAt)` 驱动开局。P0 的断线跨局、重连恢复与 E2E 路径尚未补齐；E2E 系列赛助手已修复，但全量 E2E 场景（系列赛、队伍、观战/回放）在服务恢复后尚未重新验证。后续阶段必须继续按批准路线逐阶段验证，不能将未接线功能标记为完成。
