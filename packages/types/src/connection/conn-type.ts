// 定义服务器端的 “同步连接器” 接口
export interface ServerSyncConnector<CEvt, SEvt> {
  /** 当前连接是否就绪 */
  readonly ready: boolean

  /** 向客户端发送一条事件 */
  send(evt: SEvt): void

  /** 注册来自客户端的事件回调 */
  onClientMessage(cb: (evt: CEvt) => void): void

  /** 当连接首次建立或重连成功时触发 */
  onOpen(cb: () => void): void

  /** 当连接关闭时触发 */
  onClose(cb: (code: number, reason: string) => void): void

  /**
   * 当底层网络断开（超时、断链、reset）等意外断开时回调。
   * onClose 不触发资源清理，上层可在此做“重连中”状态展示。
   */
  onDisconnect(cb: (err?: Error) => void): void;

  /**
   * 当发生 onDisconnect 之后，底层尝试自动重连成功时触发此回调。
   * 可用来恢复心跳、补发遗失的消息、同步状态等。
   */
  onReconnect(cb: () => void): void;

  /** 主动关闭连接 */
  close(code?: number, reason?: string): void
}


// 定义客户端的 “同步连接器” 接口
export interface SyncConnector<CEvt, SEvt> {
  /** 当前底层连接是否就绪、可双向通信 */
  readonly ready: boolean;

  /** 主动关闭（双边协商后的正常关闭） */
  close(code?: number, reason?: string): void;

  /** 发送事件 */
  send(evt: CEvt): void;

  // —— 注册回调 —— 

  /**
   * 当底层连接建立或在意外断开后重新连上时回调。
   * 注意：此处既包括首次 onopen，也包括重连成功。
   */
  onOpen(cb: () => void): void;

  /**
   * 当“协商关闭”或一方主动调用 close() 时回调。
   * 这时上层应当释放资源、停止定时心跳等。
   */
  onClose(cb: (code?: number, reason?: string) => void): void;

  /**
   * 当底层网络断开（超时、断链、reset）等意外断开时回调。
   * onClose 不触发资源清理，上层可在此做“重连中”状态展示。
   */
  onDisconnect(cb: (err?: Error) => void): void;

  /**
   * 当发生 onDisconnect 之后，底层尝试自动重连成功时触发此回调。
   * 可用来恢复心跳、补发遗失的消息、同步状态等。
   */
  onReconnect(cb: () => void): void;

  /** 收到对端推送的消息 */
  onMessage(cb: (evt: SEvt) => void): void;
}
