// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventListener<TKey extends string, TEvent = any> = (
  type: TKey,
  event: TEvent
) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventMap = { [key: string]: EventListener<any> };

type ListenersMap<T extends EventMap> = {
  [K in EventTypes<T>]: EventListener<K, Parameters<T[K]>>;
};

// Helper type to extract event types
export type EventTypes<T extends EventMap> = keyof T & string;

export class EventEmitter<Events extends EventMap> {
  private listeners: Partial<{
    [T in keyof Events & string]: Set<ListenersMap<Events>[T]>;
  }> = {};

  addEventListener<T extends EventTypes<Events>>(
    type: T,
    listener: Events[T]
  ): this {
    if (!this.listeners[type]) {
      this.listeners[type] = new Set();
    }
    this.listeners[type]!.add(listener);
    return this;
  }

  removeEventListener<T extends EventTypes<Events>>(
    type: T,
    listener: Events[T]
  ): this {
    this.listeners[type]?.delete(listener);
    return this;
  }

  dispatch<T extends EventTypes<Events>>(
    type: T,
    payload: Parameters<Events[T]>[1]
  ): this {
    const listeners = this.listeners[type] || new Set();
    for (const listener of listeners) {
      try {
        listener(type, payload);
      } catch (error) {
        console.error(error);
      }
    }
    return this;
  }

  propagate<T extends EventTypes<Events>>(
    type: T,
    payload: Parameters<Events[T]>[1]
  ): this {
    this.dispatch(type, payload);
    return this;
  }
}
