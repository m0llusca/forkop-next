import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { socket } from '../socket.service';
class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  listeners = new Map<string, Array<(event: Event) => void>>();
  constructor(_url: string) {
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, fn: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), fn]);
  }
  emit(type: string) {
    for (const fn of this.listeners.get(type) || []) fn(new Event(type));
  }
  close() {}
  send() {}
}
beforeEach(() => {
  socket.resetAll();
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});
afterEach(() => {
  socket.resetAll();
  vi.unstubAllGlobals();
});
it.each(['error', 'message', 'open'])(
  'ignores retired socket %s events after replacement',
  (event) => {
    const url = 'ws://router.example:9090/connections?token=fixture';
    socket.subscribe(url, vi.fn(), vi.fn());
    const old = FakeWebSocket.instances[0];
    socket.resetAll();
    const replacementError = vi.fn();
    const replacementMessage = vi.fn();
    socket.subscribe(url, replacementMessage, replacementError);
    // Closing a CONNECTING WebSocket may asynchronously dispatch error, then close.
    old.emit(event);
    expect(replacementError).not.toHaveBeenCalled();
    expect(replacementMessage).not.toHaveBeenCalled();
    const replacement = FakeWebSocket.instances[1];
    const send = vi.spyOn(replacement, 'send');
    socket.send(url, 'premature');
    expect(send).not.toHaveBeenCalled();
  },
);
