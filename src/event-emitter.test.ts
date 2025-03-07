import { beforeEach, describe, expect, test } from "bun:test";
import { EventEmitter } from "./event-emitter";

describe("EventEmitter", () => {
	let emitter: EventEmitter;

	beforeEach(() => {
		emitter = new EventEmitter();
	});

	describe("Basic Event Handling", () => {
		test("should emit and receive basic events", () => {
			let called = false;
			emitter.on("test", () => {
				called = true;
				return;
			});
			emitter.emit("test");
			expect(called).toBe(true);
		});

		test("should pass arguments to event handlers", () => {
			let receivedArgs: any[] = [];
			emitter.on("data", (...args) => {
				receivedArgs = args;
				return;
			});
			emitter.emit("data", "hello", 123, { key: "value" });
			expect(receivedArgs).toEqual(["hello", 123, { key: "value" }]);
		});

		test("should handle multiple handlers for same event", () => {
			let count = 0;
			emitter.on("increment", () => {
				count++;
				return;
			});
			emitter.on("increment", () => {
				count++;
				return;
			});
			emitter.emit("increment");
			expect(count).toBe(2);
		});
	});

	describe("Once and Limited Times", () => {
		test("should handle once events", () => {
			let count = 0;
			emitter.once("once", () => {
				count++;
				return;
			});
			emitter.emit("once");
			emitter.emit("once");
			expect(count).toBe(1);
		});

		test("should handle limitedTimes events", () => {
			let count = 0;
			emitter.limitedTimes("limited", 3, () => {
				count++;
				return;
			});
			emitter.emit("limited");
			emitter.emit("limited");
			emitter.emit("limited");
			emitter.emit("limited");
			expect(count).toBe(3);
		});
	});

	describe("Async Event Handling", () => {
		test("should handle async event emission", async () => {
			const results = await emitter.emitAsync("async", "test");
			expect(Array.isArray(results)).toBe(true);
		});

		test("should handle async handlers", async () => {
			let resolved = false;
			emitter.on(
				"async",
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					resolved = true;
				},
				{ promisify: true },
			);

			await emitter.emitAsync("async");
			expect(resolved).toBe(true);
		});
	});

	describe("Error Handling", () => {
		test("should throw on error events without handlers", () => {
			const emitter = new EventEmitter({ suppressErrors: false });
			expect(() => emitter.emit("error", new Error("test"))).toThrow();
		});

		test("should not throw on error events when suppressed", () => {
			const emitter = new EventEmitter({ suppressErrors: true });
			expect(() => emitter.emit("error", new Error("test"))).not.toThrow();
		});
	});

	describe("Handler Management", () => {
		test("should remove specific event handlers", () => {
			let count = 0;
			const handler = () => {
				count++;
				return;
			};
			emitter.on("test", handler);
			emitter.emit("test");
			emitter.off("test", handler);
			emitter.emit("test");
			expect(count).toBe(1);
		});

		test("should respect max handlers limit", () => {
			let warningMessage: string | undefined;
			const originalWarn = console.warn;
			console.warn = (msg: string) => {
				warningMessage = msg;
			};

			emitter.setMaxHandlers(2);
			emitter.on("test", () => {});
			emitter.on("test", () => {});
			emitter.on("test", () => {});

			expect(warningMessage).toBeDefined();
			expect(warningMessage).toContain(
				"Possible EventEmitter memory leak detected",
			);

			console.warn = originalWarn;
		});
	});

	describe("Event Notifications", () => {
		test("should notify on new listeners", () => {
			const emitter = new EventEmitter({ emitNewListener: true });
			let notified = false;

			// Register handler for internal newListener event
			emitter.on("newListener" as any, () => {
				notified = true;
			});

			emitter.on("test", () => {});
			expect(notified).toBe(true);
		});

		test("should notify on remove listeners", () => {
			const emitter = new EventEmitter({ emitRemoveListener: true });
			let notified = false;

			// Register handler for internal removeListener event
			emitter.on("removeListener" as any, () => {
				notified = true;
			});

			const handler = () => {};
			emitter.on("test", handler);
			emitter.off("test", handler);
			expect(notified).toBe(true);
		});
	});

	describe("Wildcard Events", () => {
		beforeEach(() => {
			emitter = new EventEmitter({ useWildcards: true });
		});

		test("should handle simple wildcards", () => {
			let count = 0;
			emitter.on("namespace.*" as any, () => {
				count++;
				return;
			});
			emitter.emit("namespace.event1" as any);
			emitter.emit("namespace.event2" as any);
			expect(count).toBe(2);
		});

		test("should handle deep wildcards", () => {
			let count = 0;
			emitter.on("namespace.**" as any, () => {
				count++;
				return;
			});
			emitter.emit("namespace.deep.event" as any);
			emitter.emit("namespace.deeper.event.here" as any);
			expect(count).toBe(2);
		});

		test("should handle mixed wildcards", () => {
			let count = 0;
			emitter.on("namespace.*.event.**" as any, () => {
				count++;
				return;
			});
			emitter.emit("namespace.foo.event.deep.path" as any);
			emitter.emit("namespace.bar.event" as any);
			emitter.emit("namespace.baz.other.deep.path" as any); // This should not trigger
			expect(count).toBe(2);
		});
	});
});
