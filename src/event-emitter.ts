import type {
	EmitterSettings,
	EventHandler,
	EventMap,
	EventName,
	EventNames,
	HandlerOptions,
	HandlerReference,
	EventEmitter as IEventEmitter,
	InternalEvents,
	WildcardHandler,
} from "./types";

/**
 * A type-safe event emitter implementation with support for wildcards, async handlers,
 * and memory leak detection.
 */
export class EventEmitter<Events extends EventMap = Record<EventName, any[]>>
	implements IEventEmitter<Events>
{
	/** Storage for event handlers mapped by event name */
	private eventHandlers: Record<
		keyof Events,
		WildcardHandler<any> | WildcardHandler<any>[] | undefined
	> = {} as Record<
		keyof Events,
		WildcardHandler<any> | WildcardHandler<any>[] | undefined
	>;

	/** Storage for internal event handlers (newListener, removeListener) */
	private internalHandlers: Partial<
		Record<keyof InternalEvents, EventHandler<any>[]>
	> = {};

	/** Handlers that receive all events regardless of name */
	private globalHandlers: Array<(...args: any[]) => void> = [];

	/** Handlers that receive all internal events */
	private globalInternalHandlers: Array<
		(event: EventName, ...args: any[]) => void
	> = [];

	/** Maximum number of handlers per event before warning */
	private maxHandlersCount: number = 10;

	/** Tree structure for storing wildcard event handlers */
	private wildcardTree: Record<string | symbol, any> = {};

	/** Whether wildcard event patterns are supported */
	private supportsWildcards: boolean;

	/** Character used to separate event namespace parts */
	private delimiter: string;

	/** Whether to emit events when new listeners are added */
	private notifyNewListener: boolean;

	/** Whether to emit events when listeners are removed */
	private notifyRemoveListener: boolean;

	/** Whether to show detailed warnings for potential memory leaks */
	private detailedLeakWarnings: boolean;

	/** Whether to suppress error events when no handlers exist */
	private suppressErrors: boolean;

	/**
	 * Creates a new EventEmitter instance
	 * @param settings Configuration options for the emitter
	 */
	constructor(settings: EmitterSettings = {}) {
		this.supportsWildcards = settings.useWildcards ?? false;
		this.delimiter = settings.namespaceDelimiter ?? ".";
		this.notifyNewListener = settings.emitNewListener ?? false;
		this.notifyRemoveListener = settings.emitRemoveListener ?? false;
		this.maxHandlersCount = settings.maxHandlers ?? 10;
		this.detailedLeakWarnings = settings.detailedLeakWarnings ?? false;
		this.suppressErrors = settings.suppressErrors ?? false;

		if (this.supportsWildcards) {
			this.wildcardTree = {};
		}
	}

	/**
	 * Prepares an event handler with optional async behavior
	 * @param event Event name or array of event names
	 * @param handler The event handler function
	 * @param options Options for handler execution
	 */
	private prepareHandler<E extends keyof Events>(
		handler: EventHandler<Events[E]>,
		options: HandlerOptions = {},
	): EventHandler<Events[E]> {
		const {
			runAsync = false,
			useNextTick = false,
			promisify = handler.constructor.name === "AsyncFunction",
		} = options;

		if (!runAsync && !useNextTick && !promisify) return handler;

		const originalHandler = handler;
		return ((...args: Events[E]) => {
			const context = this;
			if (promisify) {
				const delayFn =
					useNextTick && typeof process?.nextTick === "function"
						? Promise.resolve().then
						: (fn: () => void) =>
								new Promise((resolve) => setImmediate(resolve)).then(fn);
				return delayFn(() => originalHandler.apply(context, args));
			}
			const scheduler =
				useNextTick && typeof process?.nextTick === "function"
					? process.nextTick
					: setImmediate;
			scheduler(() => originalHandler.apply(context, args));
		}) as EventHandler<Events[E]>;
	}

	/**
	 * Emits an internal event (newListener, removeListener)
	 * @param event Internal event name
	 * @param args Arguments to pass to the handlers
	 */
	private emitInternal<K extends keyof InternalEvents>(
		event: K,
		...args: InternalEvents[K]
	): void {
		const handlers = this.internalHandlers[event];
		if (handlers) {
			handlers.forEach((handler) => handler(...args));
		}
	}

	/**
	 * Registers an event handler for the specified event(s)
	 * @param event Event name or array of event names
	 * @param handler The event handler function
	 * @param options Options for handler execution
	 * @returns The EventEmitter instance or handler reference object
	 */
	on<E extends keyof Events>(
		event: E | E[],
		handler: EventHandler<Events[E]>,
		options: HandlerOptions = {},
	): EventEmitter<Events> | HandlerReference<Events, E> {
		const { returnObject = false } = options;
		const preparedHandler = this.prepareHandler(handler, options);

		// Handle internal events
		if (
			typeof event === "string" &&
			(event === "newListener" || event === "removeListener")
		) {
			const internalEvent = event as keyof InternalEvents;
			if (!this.internalHandlers[internalEvent]) {
				this.internalHandlers[internalEvent] = [];
			}
			this.internalHandlers[internalEvent]!.push(handler);
			return this as EventEmitter<Events>;
		}

		if (this.notifyNewListener) {
			this.emitInternal("newListener", event as unknown as EventNames, handler);
		}

		if (this.supportsWildcards) {
			this.addToWildcardTree(event as unknown as EventNames, preparedHandler);
		} else {
			const eventKey = event as E;
			const currentHandlers = this.eventHandlers[eventKey];
			if (!currentHandlers) {
				this.eventHandlers[eventKey] = preparedHandler as WildcardHandler<
					Events[E]
				>;
			} else if (Array.isArray(currentHandlers)) {
				currentHandlers.push(preparedHandler as WildcardHandler<Events[E]>);
				this.checkHandlerLimit(String(eventKey), currentHandlers.length);
			} else {
				this.eventHandlers[eventKey] = [
					currentHandlers,
					preparedHandler as WildcardHandler<Events[E]>,
				];
				this.checkHandlerLimit(String(eventKey), 2);
			}
		}

		return returnObject
			? {
					emitter: this as EventEmitter<Events>,
					event,
					handler,
					remove: () => this.off(event, handler),
				}
			: (this as EventEmitter<Events>);
	}

	/**
	 * Registers a one-time event handler that will be removed after execution
	 * @param event Event name or array of event names
	 * @param handler The event handler function
	 * @param options Options for handler execution
	 */
	once<E extends keyof Events>(
		event: E | E[],
		handler: EventHandler<Events[E]>,
		options: HandlerOptions = {},
	): EventEmitter<Events> {
		return this.limitedTimes(event, 1, handler, options);
	}

	/**
	 * Registers an event handler that will be removed after specified number of executions
	 * @param event Event name or array of event names
	 * @param times Number of times the handler should execute before being removed
	 * @param handler The event handler function
	 * @param options Options for handler execution
	 */
	limitedTimes<E extends keyof Events>(
		event: E | E[],
		times: number,
		handler: EventHandler<Events[E]>,
		options: HandlerOptions = {},
	): EventEmitter<Events> {
		if (typeof handler !== "function") {
			throw new Error("Handler must be a function");
		}

		let remainingCalls = times;
		const wrappedHandler = ((...args: Events[E]) => {
			if (--remainingCalls === 0) {
				this.off(event, wrappedHandler);
			}
			return handler(...args);
		}) as EventHandler<Events[E]>;

		return this.on(event, wrappedHandler, options) as EventEmitter<Events>;
	}

	/**
	 * Synchronously emits an event with the specified arguments
	 * @param event Event name
	 * @param args Arguments to pass to the handlers
	 * @returns true if the event had listeners, false otherwise
	 */
	emit<E extends keyof Events>(event: E, ...args: Events[E]): boolean {
		if (!this.eventHandlers && !this.globalHandlers) return false;

		const handlers = this.supportsWildcards
			? this.findWildcardHandlers(String(event) as EventName)
			: this.eventHandlers[event];

		if (this.globalInternalHandlers.length) {
			this.globalInternalHandlers.forEach((handler) =>
				handler(String(event) as EventName, ...args),
			);
		}

		if (this.globalHandlers.length) {
			this.globalHandlers.forEach((handler) => handler(...args));
		}

		if (!handlers) {
			if (event === "error" && !this.suppressErrors) {
				throw args[0] instanceof Error
					? args[0]
					: new Error("Uncaught, unspecified 'error' event.");
			}
			return false;
		}

		if (typeof handlers === "function") {
			(handlers as EventHandler<Events[E]>)(...args);
			return true;
		}

		(handlers as Array<EventHandler<Events[E]>>).forEach((handler) =>
			handler(...args),
		);
		return true;
	}

	/**
	 * Asynchronously emits an event with the specified arguments
	 * @param event Event name
	 * @param args Arguments to pass to the handlers
	 * @returns Promise that resolves with array of handler results
	 */
	async emitAsync<E extends keyof Events>(
		event: E,
		...args: Events[E]
	): Promise<any[]> {
		const handlers = this.supportsWildcards
			? this.findWildcardHandlers(String(event) as EventName)
			: this.eventHandlers[event];

		const globalPromises = this.globalInternalHandlers.map((handler) =>
			handler(String(event) as EventName, ...args),
		);

		if (!handlers) {
			if (event === "error" && !this.suppressErrors) {
				return Promise.reject(
					args[0] instanceof Error
						? args[0]
						: new Error("Uncaught, unspecified 'error' event."),
				);
			}
			return Promise.all(globalPromises);
		}

		const handlerPromises = (
			Array.isArray(handlers) ? handlers : [handlers]
		).map((handler) => (handler as EventHandler<Events[E]>)(...args));

		return Promise.all([...globalPromises, ...handlerPromises]);
	}

	/**
	 * Removes an event handler for the specified event
	 * @param event Event name or array of event names
	 * @param handler The handler function to remove
	 */
	off<E extends keyof Events>(
		event: E | E[],
		handler: EventHandler<Events[E]>,
	): EventEmitter<Events> {
		if (this.supportsWildcards) {
			const eventParts = this.parseEventName(event as unknown as EventNames);
			const matches = this.findWildcardHandlers(eventParts);
			if (matches) {
				matches.forEach((match) => {
					const handlers = (match as WildcardHandler<Events[E]>)._listeners;
					if (Array.isArray(handlers)) {
						const index = handlers.findIndex(
							(h) =>
								h === handler ||
								(h as WildcardHandler<Events[E]>).listener === handler,
						);
						if (index >= 0) {
							handlers.splice(index, 1);
							if (this.notifyRemoveListener)
								this.emitInternal(
									"removeListener",
									event as unknown as EventNames,
									handler,
								);
						}
					}
				});
			}
		} else {
			const eventKey = event as E;
			const handlers = this.eventHandlers[eventKey];
			if (Array.isArray(handlers)) {
				const index = handlers.findIndex(
					(h) => h === handler || h.listener === handler,
				);
				if (index >= 0) {
					handlers.splice(index, 1);
					if (handlers.length === 0) delete this.eventHandlers[eventKey];
					if (this.notifyRemoveListener)
						this.emitInternal(
							"removeListener",
							event as unknown as EventNames,
							handler,
						);
				}
			} else if (handlers === handler || handlers?.listener === handler) {
				delete this.eventHandlers[eventKey];
				if (this.notifyRemoveListener)
					this.emitInternal(
						"removeListener",
						event as unknown as EventNames,
						handler,
					);
			}
		}
		return this as EventEmitter<Events>;
	}

	/**
	 * Finds all handlers that match a wildcard event pattern
	 * @param event Event name or pattern
	 * @returns Array of matching handlers
	 */
	private findWildcardHandlers(
		event: EventName | EventName[],
	): EventHandler<any>[] {
		const eventParts = this.parseEventName(event);
		const foundHandlers: EventHandler<any>[] = [];

		// Helper function to traverse the tree
		const traverse = (
			parts: (string | symbol)[],
			tree: Record<string | symbol, any>,
			isDeepWildcard = false,
		) => {
			// If we reach the end of the path, add any listeners at this level
			if (parts.length === 0) {
				if (tree._listeners) {
					foundHandlers.push(
						...(Array.isArray(tree._listeners)
							? tree._listeners
							: [tree._listeners]),
					);
				}
				return;
			}

			const [current, ...rest] = parts;

			// Check for exact match
			if (tree[current]) {
				traverse(rest, tree[current], false);
			}

			// Check for wildcard matches
			if (tree["*"]) {
				traverse(rest, tree["*"], false);
			}

			// Check for deep wildcard matches
			if (tree["**"]) {
				// Add current level handlers
				if (tree["**"]._listeners) {
					foundHandlers.push(
						...(Array.isArray(tree["**"]._listeners)
							? tree["**"]._listeners
							: [tree["**"]._listeners]),
					);
				}
				// Continue checking deeper levels with the same pattern
				traverse(rest, tree["**"], true);
				if (!isDeepWildcard) {
					// Also try matching the rest of the pattern at this level
					traverse(parts, tree["**"], true);
				}
			}
		};

		traverse(eventParts, this.wildcardTree);
		return [...new Set(foundHandlers)]; // Deduplicate handlers
	}

	/**
	 * Adds a handler to the wildcard event tree
	 * @param event Event name or pattern
	 * @param handler The handler function
	 */
	private addToWildcardTree(
		event: EventNames,
		handler: EventHandler<any>,
	): void {
		const eventParts = this.parseEventName(event);
		let currentLevel = this.wildcardTree;

		// For wildcard patterns, we need to handle them differently
		if (eventParts.includes("*") || eventParts.includes("**")) {
			// Create the pattern structure
			for (const [index, part] of eventParts.entries()) {
				if (part === "**") {
					// For deep wildcards, add the handler at this level and continue
					if (!currentLevel._listeners) {
						currentLevel._listeners = handler;
					} else if (Array.isArray(currentLevel._listeners)) {
						currentLevel._listeners.push(handler);
					} else {
						currentLevel._listeners = [currentLevel._listeners, handler];
					}
				}
				currentLevel = currentLevel[part] = currentLevel[part] || {};

				if (index === eventParts.length - 1) {
					if (!currentLevel._listeners) {
						currentLevel._listeners = handler;
					} else if (Array.isArray(currentLevel._listeners)) {
						currentLevel._listeners.push(handler);
					} else {
						currentLevel._listeners = [currentLevel._listeners, handler];
					}
				}
			}
		} else {
			// Regular event path
			for (const [index, part] of eventParts.entries()) {
				currentLevel = currentLevel[part] = currentLevel[part] || {};
				if (index === eventParts.length - 1) {
					if (!currentLevel._listeners) {
						currentLevel._listeners = handler;
					} else if (Array.isArray(currentLevel._listeners)) {
						currentLevel._listeners.push(handler);
					} else {
						currentLevel._listeners = [currentLevel._listeners, handler];
					}
				}
			}
		}
	}

	/**
	 * Recursively collects all handlers from a branch of the wildcard tree
	 * @param level Current tree level
	 * @param handlers Array to collect handlers into
	 */
	private collectAllHandlers(level: any, handlers: EventHandler<any>[]): void {
		for (const [key, branch] of Object.entries(level)) {
			if (key !== "_listeners" && typeof branch === "object") {
				this.collectAllHandlers(branch, handlers);
			} else if (key === "_listeners" && branch) {
				handlers.push(...(Array.isArray(branch) ? branch : [branch]));
			}
		}
	}

	/**
	 * Parses an event name into its namespace parts
	 * @param event Event name or array of names
	 * @returns Array of namespace parts
	 */
	private parseEventName(
		event: EventNames | keyof Events,
	): (string | symbol)[] {
		if (typeof event === "string") {
			return event.split(this.delimiter);
		}
		if (Array.isArray(event)) {
			return event.map((e) => String(e) as EventName);
		}
		return [String(event) as EventName];
	}

	/**
	 * Checks if number of handlers exceeds limit and warns if necessary
	 * @param event Event name
	 * @param count Number of handlers
	 */
	private checkHandlerLimit(event: string | symbol, count: number): void {
		if (this.maxHandlersCount > 0 && count > this.maxHandlersCount) {
			const warning = `Warning: Possible EventEmitter memory leak detected. ${count} handlers added for ${String(event)}.`;
			console.warn(
				this.detailedLeakWarnings
					? `${warning} Use setMaxHandlers() to increase limit.`
					: warning,
			);
		}
	}

	/**
	 * Sets the maximum number of handlers per event before warning
	 * @param count Maximum number of handlers
	 */
	setMaxHandlers(count: number): this {
		this.maxHandlersCount = count;
		return this;
	}

	/**
	 * Gets the current maximum number of handlers per event
	 * @returns Maximum number of handlers
	 */
	getMaxHandlers(): number {
		return this.maxHandlersCount;
	}
}
