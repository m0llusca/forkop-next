import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { socket } from '../socket.service';
import { logger } from '../logger.service';

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  private listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(_url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) || []) {
      listener(new Event(type));
    }
  }

  close() {}
  send() {}
}

describe('socket service', () => {
  beforeEach(() => {
    socket.resetAll();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    socket.resetAll();
    vi.unstubAllGlobals();
  });

  it('keeps the initial subscriber when the first connection fails', () => {
    const onError = vi.fn();

    socket.subscribe('ws://router.test', vi.fn(), onError);
    FakeWebSocket.instances[0].emit('error');

    expect(onError).toHaveBeenCalledOnce();
  });
  it('omits the Clash websocket token from connection logs', () => {
    logger.clear();
    socket.subscribe(
      'ws://router.test/traffic?token=private-clash-fixture',
      () => {},
    );
    FakeWebSocket.instances[0].emit('open');
    FakeWebSocket.instances[0].emit('close');
    expect(logger.getLogs()).not.toContain('private-clash-fixture');
    expect(logger.getLogs()).toContain('router.test');
  });

  it('reconnects after close and delivers new messages to the original subscriber', async () => {
    vi.useFakeTimers();
    const received: string[] = [];
    socket.subscribe('ws://reconnect.test', (message) =>
      received.push(message),
    );
    FakeWebSocket.instances[0].emit('close');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    const second = FakeWebSocket.instances[1];
    // Exercise the browser event boundary with an actual MessageEvent.
    second['listeners']
      .get('message')
      ?.forEach((listener) =>
        listener(new MessageEvent('message', { data: 'restored' })),
      );
    expect(received).toEqual(['restored']);
    socket.disconnectAll();
    await vi.advanceTimersByTimeAsync(10000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.useRealTimers();
  });
});
