import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";
import { waitFor } from "@solidjs/testing-library";
import type { ChatClientToServer, ChatServerToClient } from "@generale/types";
import type { ClientConnectionManager } from "~/ws/manager";

vi.mock("~/hooks/useWebsocket", () => ({
  useWS: vi.fn(),
}));

import { useWS } from "~/hooks/useWebsocket";
import { useChat } from "../useChat";

type ChatCallbacks = {
  open?: () => void;
  message?: (message: ChatServerToClient) => void;
  disconnect?: (error?: Error) => void;
  close?: (code?: number, reason?: string) => void;
};

function createMockChain() {
  const cbs: ChatCallbacks = {};
  let _ready = false;
  const sub = {
    get ready() {
      return _ready;
    },
    set ready(value: boolean) {
      _ready = value;
    },
    onOpen: vi.fn((cb: () => void) => {
      cbs.open = cb;
    }),
    onMessage: vi.fn((cb: (message: ChatServerToClient) => void) => {
      cbs.message = cb;
    }),
    onDisconnect: vi.fn((cb: (error?: Error) => void) => {
      cbs.disconnect = cb;
    }),
    onClose: vi.fn((cb: (code?: number, reason?: string) => void) => {
      cbs.close = cb;
    }),
    send: vi.fn<(event: ChatClientToServer) => void>(),
    close: vi.fn(),
  };
  const manager = {
    getOrCreateSub: vi.fn(() => sub),
    openDomain: vi.fn(),
    connect: vi.fn(),
    isConnected: false,
  } as Partial<ClientConnectionManager>;
  return { sub, cbs, manager };
}

async function setupChat(options: { autoOpen?: boolean } = {}) {
  const { sub, cbs, manager } = createMockChain();
  vi.mocked(useWS).mockReturnValue(manager as ClientConnectionManager);

  let chat!: ReturnType<typeof useChat>;
  let dispose!: () => void;

  createRoot((d) => {
    dispose = d;
    chat = useChat({
      domain: "test-chat",
      userId: "u1",
      ...options,
    });
  });
  await waitFor(() => expect(sub.onMessage).toHaveBeenCalledOnce());

  return { chat, cbs, sub, manager, dispose };
}

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initial state has empty messages and not connected", async () => {
    const { chat, dispose } = await setupChat({ autoOpen: false });
    expect(chat.messages()).toEqual([]);
    expect(chat.connected()).toBe(false);
    expect(chat.loadingHistory()).toBe(false);
    expect(chat.hasMoreHistory()).toBe(true);
    dispose();
  });

  it("sendMessage adds optimistic message and buffers", async () => {
    const { chat, dispose } = await setupChat({ autoOpen: false });
    chat.sendMessage("hello world");
    expect(chat.messages().length).toBe(1);
    expect(chat.messages()[0].content).toBe("hello world");
    expect(chat.messages()[0].id).toContain("local_");
    expect(chat.messages()[0].playerId).toBe("u1");
    dispose();
  });

  it("handles messages_batch server event", async () => {
    const { chat, cbs, dispose } = await setupChat({ autoOpen: false });

    cbs.message!({
      type: "messages_batch",
      messages: [
        {
          id: "m1",
          playerId: "u2",
          playerName: "Bob",
          content: "hi",
          timestamp: 100,
          type: "user",
        },
        {
          id: "m2",
          playerId: "u1",
          playerName: "Alice",
          content: "hey",
          timestamp: 200,
          type: "user",
        },
      ],
      isEnd: true,
    });

    expect(chat.messages().length).toBe(2);
    expect(chat.hasMoreHistory()).toBe(false);
    expect(chat.loadingHistory()).toBe(false);
    dispose();
  });

  it("replaces optimistic message on new_message ack for matching content and userId", async () => {
    const { chat, cbs, dispose } = await setupChat({ autoOpen: false });

    chat.sendMessage("hello");
    expect(chat.messages().length).toBe(1);
    const tempId = chat.messages()[0].id;
    expect(tempId).toContain("local_");

    cbs.message!({
      type: "new_message",
      message: {
        id: "server-msg-1",
        playerId: "u1",
        playerName: "Alice",
        content: "hello",
        timestamp: 300,
        type: "user",
      },
    });

    expect(chat.messages().length).toBe(1);
    expect(chat.messages()[0].id).toBe("server-msg-1");
    expect(chat.messages()[0].content).toBe("hello");
    dispose();
  });

  it("appends new_message when not matching optimistic entry", async () => {
    const { chat, cbs, dispose } = await setupChat({ autoOpen: false });

    cbs.message!({
      type: "new_message",
      message: {
        id: "m99",
        playerId: "u2",
        playerName: "Bob",
        content: "from other",
        timestamp: 400,
        type: "user",
      },
    });

    expect(chat.messages().length).toBe(1);
    expect(chat.messages()[0].id).toBe("m99");
    dispose();
  });

  it("sets connected false on disconnect", async () => {
    const { chat, cbs, sub, dispose } = await setupChat({ autoOpen: false });

    expect(chat.connected()).toBe(false);

    sub.ready = true;
    cbs.open!();
    expect(chat.connected()).toBe(true);

    cbs.disconnect!(new Error("lost connection"));
    expect(chat.connected()).toBe(false);
    dispose();
  });

  it("sets connected false on close", async () => {
    const { chat, cbs, sub, dispose } = await setupChat({ autoOpen: false });

    sub.ready = true;
    cbs.open!();
    expect(chat.connected()).toBe(true);

    cbs.close!(1000, "normal");
    expect(chat.connected()).toBe(false);
    dispose();
  });

  it("fetchMoreHistory sends fetch_history and sets loadingHistory", async () => {
    const { chat, cbs, sub, dispose } = await setupChat({ autoOpen: false });

    // Simulate sub ready state matching real _triggerOpen behavior
    sub.ready = true;
    cbs.open!();
    vi.clearAllMocks();

    chat.fetchMoreHistory("m1", 20);
    expect(chat.loadingHistory()).toBe(true);
    expect(sub.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "fetch_history", beforeId: "m1", limit: 20 }),
    );
    dispose();
  });

  it("does not send empty message", async () => {
    const { chat, sub, dispose } = await setupChat({ autoOpen: false });
    chat.sendMessage("   ");
    expect(chat.messages().length).toBe(0);
    expect(sub.send).not.toHaveBeenCalled();
    dispose();
  });

  it("sendQuickMessage sends send_quick_message protocol", async () => {
    const { chat, sub, dispose } = await setupChat({ autoOpen: false });
    sub.ready = true;
    chat.sendQuickMessage("help");
    expect(sub.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "send_quick_message", key: "help" }),
    );
    dispose();
  });

  it("sendQuickMessage includes scope when provided", async () => {
    const { chat, sub, dispose } = await setupChat({ autoOpen: false });
    sub.ready = true;
    chat.sendQuickMessage("danger", "game");
    expect(sub.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "send_quick_message", key: "danger", scope: "game" }),
    );
    dispose();
  });

  it("cleanup closes sub and clears pending", async () => {
    const { chat, sub, dispose } = await setupChat({ autoOpen: false });
    chat.sendMessage("test");
    dispose();
    expect(sub.close).toHaveBeenCalled();
  });
});
