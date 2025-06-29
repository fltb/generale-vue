# TODO

## 架构

重构项目为前后端一体的 monorepo。

使用 bun.js 作为 runtime 和 manager, 进行 workspace 分离

## 前端

前端使用 SolidJS TailwindCSS DaisyUI。使用 Rsbuild/Farm 作为构建

沿用 WS event, 沿用路由结构，沿用 HTTP API

对 WS 的具体数据协议，暂时沿用，后续考虑搞成 MessagePack。

状态管理重构，用 tanstack solid query + 缓存的形式。对于本地状态用 zustand

具体的 UI 解耦，使用 Headless UI 的思想，将数据和 handel 传入 render，方便日后使用 pixi 等技术重构。

对 UI 加入主题系统，尽可能自定义资源，给每个组件起一个好名字，允许覆盖样式。开放 CSS 编辑注入，同时也可以给出主题模板。也许可以支持替换组件，可以放立绘之类的。

游戏可能可以支持 mod 或插件，支持用这种形式加入新玩法和模式。

## 后端

后端使用 Elysia.js + Drizzle 编写，采用分层的架构，middleware handeler query db 等。websocket 则采用有状态管理的方式，管理各个游戏进程。同时还有有统一的事件队列管理游戏的定时任务。

后端需要写单元测试，验证正确性。

## 游戏过程阶段

游戏的 core logic, status 和 service 层次分离。游戏可以看作一个 state = step(state) 的循环。

但是游戏又需要有输入，这个输入如何介入这个循环？输入暂时会影响一个事件队列，队列的内容为将某个格子往某个方向移动，移动百分之多少的兵力。事件队列会被两种情况更新：一种是玩家的输入，插入或清空。一种是判断：游戏的逻辑运行后发现某一步非法自动清空。

需要一个库自动和前端进行同步。使用 json-patch 格式作为通用事件格式，对于高频事件，发送特定事件来优化。

二维地图，大部分情况更新几个点，少部分情况更新全图。因此需要自动判断 patch 或 snapshot。通过 diff 对象的 size 和全局状态大小的估算，计算发送全量或者 diff.

需要实现断线重连机制，支持：客户端超时/error 自动重连，客户端刷新到同一 URL 自动重连，主页给出正在进行的对局允许进入，走刷新彻底重连的逻辑。

因此，定义服务端消息格式：

```
interface ServerStateEnvelope<T> {
  domain: "game" | "chat"
  type: "state" | "action-result" | "chat-msg"
  payload: {
    version: number,
    type: "snapshot" | "patch"
    data: T | <RFC 6902>[]，
    confirmed: number
  } | {
    id: number,
    result: "abort" | "fail"
    message?: string
  }
}
```

前端保存状态：

```
version
state: T
```

前端消息：

```
interface ClientActrionEnvelope<T> {
  id: number // 自增
  type: "move-queue",
  payload: { x: number, y: number, to: UP|DOWN|RIGHT|LEFT }[]
}
```

事件顺序

```
打开客户端 WS 链接 - 服务端接收链接，鉴权，检查游戏 session, 将玩家加入/重进 - 服务端建立链接 - 客户端打开链接，发送 sync 事件，带上 version - 服务端补发pathc/snapshot - 服务端不断定时发回 game
```

1. 链接打开或彻底重连，发送的 version 为 0, 那么服务端给全量
2. 链接抖动重连，发送的 version 为整数，那么给到当前最新 version 之前的。

我们可以暂时认为 state 是每隔一个 tick 发回的状态。而且客户端的 state 仅仅是服务端 state 的一个同步。

关于玩家可以进行的操作：

1. 移动队列，我们称为 move queue，可以将操作放进队尾，然后服务端不断确认操作是否成功，或者队列应该被置空。队中的元素应该展示出来。
2. 发送消息，玩家向后端发送一个消息，失败或者成功。成功后进入消息记录。发送消息应该有个一个 loading 的过程。

实现备选方案：一种是将上面的放进 state, 那么就会需要引入 state 的乐观更新，即虽然服务器才是权威修改，但是我们本地先修改，等服务端确认我们的操作。

在提交修改 event 的时候，将 move queue 和 message list 的变更先在当前基础上 apply 到一个以当前 state 为基础的乐观更新 queue 上面。

然后在后端的每个 tick event 中，对乐观更新 queue 的成功和失败的 id 进行确认。客户端总是假设事件成功，如果超时或失败再出队。

那么每次展示的状态就是 queue 和当前 state 的派生状态。派生的方式是过让 queue 拿着 state 用 applyEvent(state, event) 函数过一个 reduce。

那么 move queue 就这么出来了，后面 push 进去的统统加上一个 `pending: true`。

关于发送消息，因为这些行为相对独立，将其从 state 中剥离出来，用 solid-query 管理。仅仅共用 WS 进行事件通知？还是坚持一致性设计？分离的好处是显然的，就是什么条件需要分离？如果我一个操作需要直接对 game state 产生影响，放进计算逻辑中，那么他适合放进 state 中。除此之外，剥离。

现在继续设计异常处理逻辑，并校验设计是否正确和健壮。

目前对游戏的操作仅仅有一个。那么心智模型就比较简单。我们考虑：

- 操作成功
- 操作失败
- 操作超时
- 断线重连接

这类事务的一致性问题。

假设没有任何操作，游戏逻辑是 deterministic 的，不存在一致性问题。

失败和超时都是显然的。然后 confirmed 只有一个数字，因为我们假设队列按顺序 apply, 即使有操作被忽略了也算了，服务端才是正确的。

断线重联中，分情况讨论：如果是彻底重连，本地的操作丢失。正在发送的状态可能：收到了，没收到。

如果收到并返回了，就成为历史了，不管。如果收到了，处理了，返回，正常。收到但是没处理完？这个情况禁止，在游戏 state 计算的时候锁住状态读写。没收到，那就服务器和客户端都丢了，等于没存在过。

抖动重连：客户端同时发送这些事件：当前 version, 当前操作队列。服务端根据 version 给 snapshot/patch ，还是带上 confirmed id, 正常处理。这时候后端就需要有一个逻辑：id 小于 confirmed 的操作直接丢弃，防止重复执行。

## 游戏开始前阶段

游戏开始前，玩家可以进出房间，房主可以自定义游戏设置，然后其他人可以看到房主的设置。房主退出之后顺序选一个玩家成为房主。

玩家的事件管理。

game state 应该包含游戏阶段。

## 前后端公用接口定义

状态，需要：

- status: "lobby" | "in-game" | "over"
- players: 一个对象，player id 和游戏内信息，包括颜色，分组，等等
- settings: 游戏设置
- map?: 地图
- queue?: 操作队列
- alert?: game over 的提示（需要吗？）

客户端向服务端的事件，需要

- （隐含）加入房间，退出房间，以 websocket 为准
- 房主设置 settings
- 玩家操作队列
- 玩家发送聊天信息（独立在 chat domain）

服务端向客户端，需要这几个 domain：

- game
- chat
- connection # 用来处理一些 ws 相关的事件监听和异常处理

game 的作为 state 的更新事件，chat 用来提示拉取消息事件

game 的消息分为

- patch
- snapshot
- action-result

## 用户管理和 session 管理和各种 info 同步的模板

这套，AI 生成，吧

- user
- profile
- login
- register 这里可能需要邮箱支持，做成选项

然后大厅里面的 rooms, 用一个简单推送逻辑。不复用之前繁琐的逻辑了，直接做事件推送 invalid 缓存请求，作为 restful 的补充

加入游戏的几个实现：

- 先 post 一个 enter room 成功后拿着 room id 新开一个 gamews 的连接
- 先 post 一个 enter room 成功后拿着 room id 往全局 ws 里面一塞，再在 ws 侧等一个 enter game 事件发过来
- 先 post 一个 enter room ，再在 ws 侧等一个 enter game 事件发过来。
- 在 ws 里面发一个 enter room, 再在 ws 侧等一个 enter game 事件发过来。

详细讨论游戏内断线重联，游戏窗口意外刷新，或者退到主页面了又刷新，怎么弄？

确定使用纯 WS 的方式。

用一个 domain: comm 包装一个 comm hook 出来进行逻辑管理。这里只需要一些简单的事务更新和一些请求即可。

意外刷新和断线重联触发原来的逻辑，退到主页面的话，因为：当前游戏正在进行 且 当前页面不是 /game/:id，那么，弹出重连。

对于自定义房间，采用瀑布流 solid query + ws event + solid virtual 的形式。

然后破坏性更新就给你个按钮说有更新要不要刷新就行。update 就只管改了得了。

再开个官方匹配模式，进去锁房间设置，然后自动处理进房间的逻辑。

差不多得了。

### 前端具体状态管理代码示例（AI）

```typescript
// src/context/WebSocketProvider.tsx

import { createContext, useContext, onCleanup, createSignal, Accessor, Setter, ParentComponent } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { ServerEvent, ClientEvent } from '../types';

type Status = 'connecting' | 'open' | 'closed';
type Listener = (event: ServerEvent) => void;

interface WebSocketContextValue {
  send: (message: ClientEvent) => void;
  subscribe: (domain: string, callback: Listener) => void;
  status: Accessor<Status>;
}

const WebSocketContext = createContext<WebSocketContextValue>();

export const WebSocketProvider: ParentComponent<{ url: string }> = (props) => {
  const [listeners, setListeners] = createStore<Record<string, Listener[]>>({});
  const [status, setStatus] = createSignal<Status>('connecting');
  let ws: WebSocket;
  let reconnectAttempts = 0;

  const emitter = {
    on: (domain: string, callback: Listener) => {
      setListeners(domain, (l = []) => [...l, callback]);
    },
    off: (domain: string, callback: Listener) => {
      setListeners(domain, (l) => l.filter(cb => cb !== callback));
    },
    emit: (event: ServerEvent) => {
      if (listeners[event.domain]) {
        listeners[event.domain].forEach(cb => cb(event));
      }
    }
  };

  const connect = () => {
    ws = new WebSocket(props.url);
    setStatus('connecting');

    ws.onopen = () => {
      setStatus('open');
      reconnectAttempts = 0;
      emitter.emit({ domain: 'connection', type: 'status_change', payload: { status: 'open' } } as any);
    };

    ws.onmessage = (event) => {
      try {
        const serverEvent: ServerEvent = JSON.parse(event.data);
        emitter.emit(serverEvent);
      } catch (e) {
        console.error("Failed to parse server event:", event.data);
      }
    };

    ws.onclose = () => {
      setStatus('closed');
      emitter.emit({ domain: 'connection', type: 'status_change', payload: { status: 'closed' } } as any);
      const delay = Math.min(1000 * (2 ** reconnectAttempts), 5000);
      reconnectAttempts++;
      setTimeout(connect, delay);
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      ws.close(); // 这会触发 onclose 和重连逻辑
    };
  };

  connect();
  onCleanup(() => {
    ws.onclose = null; // 防止在组件卸载时重连
    ws.close();
  });

  const contextValue: WebSocketContextValue = {
    send: (message) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    subscribe: (domain, callback) => {
      emitter.on(domain, callback);
      onCleanup(() => emitter.off(domain, callback));
    },
    status,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {props.children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error("useWebSocket must be used within a WebSocketProvider");
  return context;
};

// src/hooks/useVersionedOptimisticState.ts

import { createStore, reconcile } from 'solid-js/store';
import { createMemo, Accessor } from 'solid-js';
import { produceWithPatches, applyPatches, Patch } from 'immer';
import type { GameState, GameStatePayload } from '../types';

let optimisticIdCounter = 0;

export function useVersionedOptimisticState(
  initialState: GameState,
  initialVersion: number = 0,
  applyEvent: (state: GameState, event: any) => GameState
) {
  const [state, setState] = createStore({
    version: initialVersion,
    base: initialState,
    optimisticQueue: [] as { id: number; event: any }[],
  });

  const mergedState: Accessor<GameState> = createMemo(() =>
    state.optimisticQueue.reduce(
      (currentState, item) => applyEvent(currentState, item.event),
      state.base
    )
  );

  function dispatchOptimisticEvent(event: any): number {
    const newId = ++optimisticIdCounter;
    setState('optimisticQueue', q => [...q, { id: newId, event }]);
    return newId;
  }

  function reconcileFromServer(payload: GameStatePayload) {
    let newBase: GameState;
    if (payload.type === 'snapshot') {
      newBase = payload.data as GameState;
    } else {
      // 使用 Immer 的 applyPatches 来应用服务器发来的标准 patch
      newBase = applyPatches(state.base, payload.data as Patch[]);
    }
    setState('base', reconcile(newBase, { key: 'id', merge: true }));
    setState('version', payload.version);

    if (payload.confirmedOptimisticIds?.length > 0) {
      const confirmedSet = new Set(payload.confirmedOptimisticIds);
      setState('optimisticQueue', q => q.filter(item => !confirmedSet.has(item.id)));
    }
  }

  function getPendingEvents(): any[] {
    return state.optimisticQueue.map(item => ({...item.event, optimisticId: item.id}));
  }
  
  return {
    mergedState,
    version: () => state.version,
    getPendingEvents,
    dispatchOptimisticEvent,
    reconcileFromServer,
  };
}

// src/hooks/useSyncedState.ts

import { createEffect, Accessor } from 'solid-js';
import { useVersionedOptimisticState } from './useVersionedOptimisticState';
import { useWebSocket } from '../context/WebSocketProvider';
import type { ServerEvent, ClientEvent, GameState, ActionFailedPayload } from '../types';

interface SyncedStateOptions<TState, TAction> {
  domain: string;
  initialState: TState;
  initialVersion?: number;
  applyEvent: (state: TState, action: TAction) => TState;
}

export function useSyncedState<TState extends GameState, TAction extends { type: string, payload?: any }>({
  domain,
  initialState,
  initialVersion,
  applyEvent,
}: SyncedStateOptions<TState, TAction>) {
  
  const stateManager = useVersionedOptimisticState(initialState, initialVersion, applyEvent as any);
  const ws = useWebSocket();
  const pendingRequests = new Map<number, { resolve: (v: any) => void; reject: (e?: any) => void; timeoutId: number }>();

  function handleServerEvent(serverEvent: ServerEvent) {
    switch (serverEvent.type) {
      case 'state_update':
        stateManager.reconcileFromServer(serverEvent.payload);
        serverEvent.payload.confirmedOptimisticIds?.forEach(id => {
          if (pendingRequests.has(id)) {
            const request = pendingRequests.get(id)!;
            clearTimeout(request.timeoutId);
            request.resolve({ status: 'success' });
            pendingRequests.delete(id);
          }
        });
        break;
      
      case 'action_failed':
        const payload = serverEvent.payload as ActionFailedPayload;
        if (pendingRequests.has(payload.optimisticId)) {
          const request = pendingRequests.get(payload.optimisticId)!;
          clearTimeout(request.timeoutId);
          request.reject(new Error(payload.message));
          pendingRequests.delete(payload.optimisticId);
        }
        // 应用失败状态
        stateManager.dispatchOptimisticEvent({ type: `${payload.originalActionType}_FAILED`, payload });
        break;
    }
  }

  function connect() {
    console.log(`[SyncedState:${domain}:${resourceId}] Connecting and subscribing...`);
    
    // 1. 订阅特定领域的事件
    ws.subscribe(domain, handleServerEvent);
    
    // 2. 订阅连接事件，以处理断线重连
    const connectionListener = (event: ServerEvent) => {
      if (event.payload.status === 'open') {
        console.log(`[SyncedState:${domain}:${resourceId}] Connection is open, sending sync request.`);
        // 发送带 resourceId 的同步请求
        ws.send({ 
          domain, 
          type: 'sync_request', 
          payload: { version: stateManager.version(), resourceId } as any 
        });

        // 重提交逻辑...
      }
    };
    ws.subscribe('connection', connectionListener);
    
    // 3. 立即触发一次同步（如果已连接）
    if (ws.status() === 'open') {
        connectionListener({ payload: { status: 'open' } } as any);
    }
    
    // 4. 返回一个清理函数，用于停止订阅
    return () => {
      console.log(`[SyncedState:${domain}:${resourceId}] Disconnecting and unsubscribing...`);
      ws.unsubscribe(domain, handleServerEvent);
      ws.unsubscribe('connection', connectionListener);
    };
  }

  function dispatch(action: TAction) {
    const optimisticId = stateManager.dispatchOptimisticEvent(action);
    ws.send({ domain, type: action.type, payload: { ...action.payload, optimisticId } });
  }

  async function commit(action: TAction): Promise<any> {
    const optimisticId = stateManager.dispatchOptimisticEvent(action);
    ws.send({ domain, type: action.type, payload: { ...action.payload, optimisticId } });
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(optimisticId);
        reject(new Error("请求超时"));
      }, 10000);
      pendingRequests.set(optimisticId, { resolve, reject, timeoutId });
    });
  }

  return {
    state: stateManager.mergedState,
    connect,
    commit,
    dispatch,
  };
}

// src/hooks/useRealtimeGame.ts

import { produce, Draft } from 'immer';
import { useSyncedState } from './useSyncedState';
import type { GameState, GameSettings, Move, GameAction, UpdateSettingAction, SubmitMoveQueueAction } from '../types';

const GameActions = {
  updateSetting: (key: keyof GameSettings, value: any): UpdateSettingAction => ({
    type: 'UPDATE_SETTING',
    payload: { key, value },
  }),
  submitMoveQueue: (moves: Move[]): SubmitMoveQueueAction => ({
    type: 'SUBMIT_MOVE_QUEUE',
    payload: { moves },
  }),
};

const applyGameEvent = produce((draft: Draft<GameState>, action: GameAction) => {
  switch (action.type) {
    case 'UPDATE_SETTING':
      draft.settings[action.payload.key] = action.payload.value;
      break;
    case 'SUBMIT_MOVE_QUEUE':
      draft.moveQueue = action.payload.moves;
      draft.moveQueue.forEach(move => { move.status = 'pending'; });
      break;
  }
});

// hooks/useCommunicationManager.ts
import { useWebSocket } from '../context/WebSocketProvider';

export function useCommunicationManager() {
  const ws = useWebSocket();

  return {
    // 加入一个游戏房间的频道
    joinGameChannel: (roomId: string) => {
      ws.send({
        domain: 'system',
        type: 'JOIN_ROOM',
        payload: { roomId },
      });
    },
    // 离开一个游戏房间的频道
    leaveGameChannel: (roomId: string) => {
      ws.send({
        domain: 'system',
        type: 'LEAVE_ROOM',
        payload: { roomId },
      });
    },
    // ... 其他全局指令
  };
}

export function useRealtimeGame(initialData: { state: GameState; version: number }) {
  // 1. 调用 useSyncedState，但它此时还未激活
  const gameSync = useSyncedState<GameState, GameAction>({
    domain: 'game',
    resourceId: gameId, // 传递 gameId
    initialState: initialData.state,
    initialVersion: initialData.version,
    applyEvent: applyGameEvent,
  });

  // 2. 使用我们之前设计的通信管理器
  const comms = useCommunicationManager();

  // 3. 使用 onMount 和 onCleanup 来管理生命周期
  onMount(() => {
    // a. 告诉服务器，我想加入这个游戏房间的频道
    comms.joinGameChannel(gameId);
    
    // b. 激活底层的状态同步逻辑，它会返回一个清理函数
    const cleanupSync = gameSync.connect();
    
    // c. 在组件卸载时，执行清理
    onCleanup(() => {
      cleanupSync();
      comms.leaveGameChannel(gameId);
    });
  });

  // 4. 返回的 API 保持不变，但现在它们只在组件挂载后才有效
  return {
    gameState: gameSync.state,
    // isConnected 不再需要，因为有全局的状态栏
    actions: {
      commitSetting: (key, value) => gameSync.commit(GameActions.updateSetting(key, value)),
      dispatchMoveQueue: (moves) => gameSync.dispatch(GameActions.submitMoveQueue(moves)),
    },
  };
}

// src/types.ts

import type { Patch } from 'immer';

// =================================================================
// 通用网络事件类型
// =================================================================

export type AppDomain = 'game' | 'chat';

// 客户端 -> 服务端
export interface ClientEvent<T = any> {
  domain: AppDomain;
  type: string;
  payload: T & { optimisticId: number };
}

// 服务端 -> 客户端
export interface ServerEvent<T = any> {
  domain: AppDomain;
  type: string;
  payload: T;
}

// =================================================================
// 游戏状态相关类型 (domain: 'game')
// =================================================================

export interface GameSettings {
  mapSize: 'small' | 'medium' | 'large';
  winCondition: 'conquest' | 'points';
}

export interface Move {
  id: string; // 每个移动指令也应该有唯一ID
  unitId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  status?: 'pending' | 'confirmed';
}

export interface GameState {
  version: number;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  settings: GameSettings;
  players: { id: string; name: string }[];
  moveQueue: Move[];
  lastError?: string | null;
}

// 游戏状态更新负载
export interface GameStatePayload {
  version: number;
  type: 'snapshot' | 'patch';
  data: GameState | Patch[]; // Immer patch[] or snapshot
  confirmedOptimisticIds: number[];
}

// 游戏动作失败负载
export interface ActionFailedPayload {
  optimisticId: number;
  originalActionType: string;
  reason: string;
  message: string;
}

// =================================================================
// 游戏动作 (Action) 类型
// =================================================================

export interface UpdateSettingAction {
  type: 'UPDATE_SETTING';
  payload: { key: keyof GameSettings; value: any };
}

export interface SubmitMoveQueueAction {
  type: 'SUBMIT_MOVE_QUEUE';
  payload: { moves: Move[] };
}

// 所有游戏动作的联合类型
export type GameAction = UpdateSettingAction | SubmitMoveQueueAction;


// =================================================================
// 聊天相关类型 (domain: 'chat')
// =================================================================

export interface ChatMessage {
  id: string; // 服务端生成的唯一ID或客户端的临时ID
  user: string;
  text: string;
  timestamp: string;
  status?: 'sending' | 'failed';
}
```