import { bench, run } from "mitata";

import { EventEmitter as NativeEventEmitter } from "node:events";
import { EventEmitter } from "safe-event-emitter-ts";

// Create test data
const smallPayload = { id: 1, message: "test" };
const mediumPayload = {
	id: 1,
	message: "test",
	data: Array(100).fill("test-data"),
	metadata: {
		timestamp: Date.now(),
		source: "benchmark",
		tags: Array(10).fill("tag"),
	},
};
const largePayload = {
	id: 1,
	message: "test",
	data: Array(1000).fill("test-data"),
	metadata: {
		timestamp: Date.now(),
		source: "benchmark",
		tags: Array(100).fill("tag"),
		nested: Array(100).fill({ data: "nested-data" }),
	},
};

// Setup emitters
const emitter = new EventEmitter();
const nativeEmitter = new NativeEventEmitter();

// Add multiple listeners for testing
const listener = () => {};
const errorListener = (error: Error) => {};
const payloadListener = (data: any) => {};

// Single listener benchmarks
bench("emit - no payload", () => {
	emitter.emit("test");
}).gc("inner");

bench("native emit - no payload", () => {
	nativeEmitter.emit("test");
}).gc("inner");

// Payload size benchmarks
bench("emit - small payload", () => {
	emitter.emit("test", smallPayload);
}).gc("inner");

bench("native emit - small payload", () => {
	nativeEmitter.emit("test", smallPayload);
}).gc("inner");

bench("emit - medium payload", () => {
	emitter.emit("test", mediumPayload);
}).gc("inner");

bench("native emit - medium payload", () => {
	nativeEmitter.emit("test", mediumPayload);
}).gc("inner");

bench("emit - large payload", () => {
	emitter.emit("test", largePayload);
}).gc("inner");

bench("native emit - large payload", () => {
	nativeEmitter.emit("test", largePayload);
}).gc("inner");

// Multiple listeners benchmarks
bench("emit - 5 listeners setup", () => {
	const e = new EventEmitter();
	for (let i = 0; i < 5; i++) {
		e.on("test", listener);
	}
	e.emit("test", smallPayload);
}).gc("inner");

bench("native emit - 5 listeners setup", () => {
	const e = new NativeEventEmitter();
	for (let i = 0; i < 5; i++) {
		e.on("test", listener);
	}
	e.emit("test", smallPayload);
}).gc("inner");

// Error handling benchmarks
bench("emit - with error listener", () => {
	const e = new EventEmitter();
	e.on("error", errorListener);
	e.emit("test", new Error("test error"));
}).gc("inner");

bench("native emit - with error listener", () => {
	const e = new NativeEventEmitter();
	e.on("error", errorListener);
	e.emit("test", new Error("test error"));
}).gc("inner");

// Add/Remove listener benchmarks
bench("add/remove listener", () => {
	emitter.on("test", payloadListener);
	emitter.off("test", payloadListener);
}).gc("inner");

bench("native add/remove listener", () => {
	nativeEmitter.on("test", payloadListener);
	nativeEmitter.off("test", payloadListener);
}).gc("inner");

await run();
