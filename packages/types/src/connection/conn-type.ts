import { Context } from 'elysia'

// 定义服务器端的 “同步连接器” 接口
export interface ServerSyncConnector<CEvt, SEvt> {
  /** 当前连接是否就绪 */
  readonly ready: boolean

  /** 向客户端发送一条事件 */
  send(evt: SEvt): void

  /** 注册来自客户端的事件回调 */
  onClientMessage(cb: (evt: CEvt, ctx: Context) => void): void

  /** 当连接首次建立或重连成功时触发 */
  onOpen(cb: (ctx: Context) => void): void

  /** 当连接关闭时触发 */
  onClose(cb: (ctx: Context, code: number, reason: string) => void): void

  /** 主动关闭连接 */
  close(code?: number, reason?: string): void
}


// 定义客户端的 “同步连接器” 接口
export interface SyncConnector<CEvt, SEvt> {
  /** 当前连接是否就绪 */
  readonly ready: boolean

  /** 向服务端发送一条事件 */
  send(evt: CEvt): void

  /** 注册来自服务端的事件回调 */
  onClientMessage(cb: (evt: SEvt) => void): void

  /** 当连接首次建立或重连成功时触发 */
  onOpen(cb: (ctx: Context) => void): void

  /** 当连接关闭时触发 */
  onClose(cb: (code?: number, reason?: string) => void): void

  /** 主动关闭连接 */
  close(code?: number, reason?: string): void
}
