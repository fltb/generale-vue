import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createRoot, createSignal, type JSX } from "solid-js";
import {
  SyncedStateServerEventType,
  SyncedStateServerStateUpdatePayloadType,
  type SyncedStateServerEvent,
} from "@generale/types";

vi.mock("~/hooks/useWebsocket", () => ({
  useWS: vi.fn(),
}));

import { useWS } from "~/hooks/useWebsocket";
import type { ClientConnectionManager } from "~/ws/manager";
import { useSyncedState } from "../useSyncedState";

type WireState = { value: number; nested: { enabled: boolean } };
type TestAction = { readonly optimisticId: number; readonly type: "SET"; readonly payload: number };
type CustomEvent = { readonly kind: "notice" };
type WireEvent = SyncedStateServerEvent<WireState, CustomEvent>;
type CommitResult = { status: string; optimisticId: number; message?: string };
type Commit = (action: Omit<TestAction, "optimisticId">, timeoutMs?: number) => Promise<CommitResult>;

function applyEvent(state: WireState, action: TestAction): WireState {
  return action.type === "SET" ? { ...state, value: action.payload } : state;
}

function createMockTransport() {
  let openCallback: (() => void) | undefined;
  let messageCallback: ((payload: WireEvent) => void) | undefined;
  let disconnectCallback: ((error?: Error) => void) | undefined;
  let closeCallback: ((code?: number, reason?: string) => void) | undefined;
  const sub = {
    ready: false,
    onOpen(callback: () => void) {
      openCallback = callback;
    },
    onMessage(callback: (payload: WireEvent) => void) {
      messageCallback = callback;
    },
    onDisconnect(callback: (error?: Error) => void) {
      disconnectCallback = callback;
    },
    onClose(callback: (code?: number, reason?: string) => void) {
      closeCallback = callback;
    },
    send: vi.fn(),
    close: vi.fn(() => {
      sub.ready = false;
      closeCallback?.();
    }),
  };
  const manager = {
    isConnected: true,
    connect: vi.fn(),
    openDomain: vi.fn(),
    getOrCreateSub: vi.fn(() => sub),
  };
  return {
    manager,
    sub,
    emitOpen() {
      sub.ready = true;
      openCallback?.();
    },
    emitMessage(event: WireEvent) {
      messageCallback?.(event);
    },
    emitDisconnect(error?: Error) {
      sub.ready = false;
      disconnectCallback?.(error);
    },
  };
}

function TestHarness(props: { autoOpen?: boolean; onCommit?: (commit: Commit) => void }): JSX.Element {
  const [custom, setCustom] = createSignal("none");
  const [request, setRequest] = createSignal("none");
  const state = useSyncedState<WireState, TestAction, CustomEvent>({
    domain: "test",
    initialState: { value: 0, nested: { enabled: false } },
    applyEvent,
    onCustomEvent: (event) => setCustom(event.kind),
    autoOpen: props.autoOpen ?? false,
  });

  props.onCommit?.(state.commit);

  function commitWithTimeout() {
    void state.commit({ type: "SET", payload: 42 }, 20).then(
      () => setRequest("success"),
      (error: Error) => setRequest(error.message),
    );
  }

  return (
    <div>
      <output data-testid="state">{JSON.stringify(state.state())}</output>
      <output data-testid="ready">{String(state.isReady())}</output>
      <output data-testid="custom">{custom()}</output>
      <output data-testid="request">{request()}</output>
      <button type="button" onClick={() => void state.connect()}>
        Connect
      </button>
      <button type="button" onClick={() => state.disconnect()}>
        Disconnect
      </button>
      <button type="button" onClick={commitWithTimeout}>
        Commit
      </button>
    </div>
  );
}

function snapshot(value: WireState, version = 1, confirmedOp = 0): WireEvent {
  return {
    type: SyncedStateServerEventType.STATE_UPDATE,
    payload: {
      type: SyncedStateServerStateUpdatePayloadType.SNAPSHOT,
      version,
      confirmedOp,
      payload: value,
    },
  };
}
async function openTransport(transport: { emitOpen(): void }) {
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  await Promise.resolve();
  await Promise.resolve();
  transport.emitOpen();
}


describe("useSyncedState wire adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects and emits a literal sync request after the connector opens", async () => {
    const transport = createMockTransport();
    vi.mocked(useWS).mockReturnValue(transport.manager as ClientConnectionManager);
    render(() => <TestHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await vi.waitFor(() => expect(transport.manager.openDomain).toHaveBeenCalledWith("test", {}));
    transport.emitOpen();

    expect(transport.sub.send).toHaveBeenCalledWith({ type: "sync_request", version: 0 });
  });

  it("adapts literal snapshot, patch, and custom wire messages", async () => {
    const transport = createMockTransport();
    vi.mocked(useWS).mockReturnValue(transport.manager as ClientConnectionManager);
    render(() => <TestHarness />);
    await openTransport(transport);

    transport.emitMessage(snapshot({ value: 10, nested: { enabled: false } }));
    expect(screen.getByTestId("state")).toHaveTextContent(
      JSON.stringify({ value: 10, nested: { enabled: false } }),
    );

    transport.emitMessage({
      type: SyncedStateServerEventType.STATE_UPDATE,
      payload: {
        type: SyncedStateServerStateUpdatePayloadType.PATCH,
        version: 2,
        confirmedOp: 0,
        payload: [{ op: "replace", path: "/value", value: 20 }],
      },
    });
    expect(screen.getByTestId("state")).toHaveTextContent(JSON.stringify({ value: 20, nested: { enabled: false } }));

    transport.emitMessage({
      type: SyncedStateServerEventType.CUSTOM,
      payload: { kind: "notice" },
    });
    expect(screen.getByTestId("custom")).toHaveTextContent("notice");
  });

  it("disconnects the domain and reports not-ready state", async () => {
    const transport = createMockTransport();
    vi.mocked(useWS).mockReturnValue(transport.manager as ClientConnectionManager);
    render(() => <TestHarness />);
    await openTransport(transport);
    expect(transport.sub.ready).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(transport.sub.close).toHaveBeenCalledTimes(1);
    expect(transport.sub.ready).toBe(false);
  });

  it("rejects a commit when the server does not respond before timeout", async () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    vi.mocked(useWS).mockReturnValue(transport.manager as ClientConnectionManager);
    render(() => <TestHarness />);
    await openTransport(transport);

    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    await vi.advanceTimersByTimeAsync(20);
    expect(screen.getByTestId("request")).toHaveTextContent("timeout");
  });

  it("rejects pending commit and clears its timer when its owner is disposed", async () => {
    const transport = createMockTransport();
    vi.mocked(useWS).mockReturnValue(transport.manager as ClientConnectionManager);
    let commit: Commit | undefined;
    let unmounted = false;
    let dispose: (() => void) | undefined;
    createRoot((disposeRoot) => {
      dispose = disposeRoot;
      TestHarness({ onCommit: (value) => (commit = value) });
    });

    expect(commit).toBeDefined();
    const pending = commit!({ type: "SET", payload: 7 }, 1000);
    const rejection = expect(pending).rejects.toThrow("unmounted");
    dispose!();
    await rejection;
    expect(transport.sub.close).toHaveBeenCalledTimes(1);
  });
});
