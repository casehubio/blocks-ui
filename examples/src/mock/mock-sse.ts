const instances = new Map<string, Set<MockSSESource>>();

export class MockSSESource {
  readonly url: string;
  readyState: number = 1; // OPEN
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  private listeners = new Map<string, Set<EventListener>>();

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    let set = instances.get(url);
    if (!set) {
      set = new Set();
      instances.set(url, set);
    }
    set.add(this);
  }

  close(): void {
    this.readyState = 2;
    const set = instances.get(this.url);
    if (set) set.delete(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    let handlers = this.listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(type, handlers);
    }
    handlers.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(_event: Event): boolean { return true; }

  static pushEvent(url: string, data: unknown): void {
    const set = instances.get(url);
    if (!set) return;
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    for (const source of set) {
      if (source.readyState === 1 && source.onmessage) {
        source.onmessage(event);
      }
    }
  }

  static pushNamedEvent(url: string, name: string, data: unknown): void {
    const set = instances.get(url);
    if (!set) return;
    const event = new MessageEvent(name, { data: JSON.stringify(data) });
    for (const source of set) {
      if (source.readyState !== 1) continue;
      const handlers = source.listeners.get(name);
      if (!handlers) continue;
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  static pushToAll(data: unknown): void {
    for (const [url] of instances) {
      MockSSESource.pushEvent(url, data);
    }
  }

  static resetAll(): void {
    for (const set of instances.values()) {
      for (const source of set) source.readyState = 2;
      set.clear();
    }
    instances.clear();
  }
}
