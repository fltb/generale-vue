// ./packages/shared/src/types.ts

// Client -> Server & Server -> Client
export interface AppEvent<T = any> {
  domain: 'game' | 'chat' | 'lobby' | 'system';
  type: string;
  payload: T;
}

export interface User {
  id: string;
  username: string;
}

export type GamePhase = 'waiting' | 'playing' | 'finished';