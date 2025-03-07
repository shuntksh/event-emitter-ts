export type EventName = string | symbol;
export type EventNames = EventName | EventName[];
export type EventMap = {
	[K in EventName]: any[];
};
export type EventHandler<T extends any[] = any[]> = (
	...args: T
) => void | Promise<void>;

export interface HandlerOptions {
	runAsync?: boolean;
	useNextTick?: boolean;
	promisify?: boolean;
	returnObject?: boolean;
}

export interface HandlerReference<
	Events extends EventMap,
	E extends keyof Events,
> {
	emitter: EventEmitter<Events>;
	event: E | E[];
	handler: EventHandler<Events[E]>;
	remove(): void;
}

export interface WildcardHandler<T extends any[] = any[]>
	extends EventHandler<T> {
	_listeners?: EventHandler<T> | EventHandler<T>[];
	listener?: EventHandler<T>;
}

export type InternalEvents = {
	newListener: [EventNames, EventHandler<any>];
	removeListener: [EventNames, EventHandler<any>];
};

export interface EventEmitter<
	Events extends EventMap = Record<EventName, any[]>,
> {
	on<E extends keyof Events>(
		event: E | E[],
		handler: EventHandler<Events[E]>,
		options?: HandlerOptions,
	): EventEmitter<Events> | HandlerReference<Events, E>;

	once<E extends keyof Events>(
		event: E | E[],
		handler: EventHandler<Events[E]>,
		options?: HandlerOptions,
	): EventEmitter<Events>;

	limitedTimes<E extends keyof Events>(
		event: E | E[],
		times: number,
		handler: EventHandler<Events[E]>,
		options?: HandlerOptions,
	): EventEmitter<Events>;

	emit<E extends keyof Events>(event: E, ...args: Events[E]): boolean;
	emitAsync<E extends keyof Events>(
		event: E,
		...args: Events[E]
	): Promise<any[]>;
	off<E extends keyof Events>(
		event: E | E[],
		handler: EventHandler<Events[E]>,
	): EventEmitter<Events>;
}

export interface EmitterSettings {
	useWildcards?: boolean;
	namespaceDelimiter?: string;
	emitNewListener?: boolean;
	emitRemoveListener?: boolean;
	maxHandlers?: number;
	detailedLeakWarnings?: boolean;
	suppressErrors?: boolean;
}
