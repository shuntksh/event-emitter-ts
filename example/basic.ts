import { EventEmitter } from "safe-event-emitter-ts";

// Example usage:
type MyEvents = {
	"user:login": [{ id: string; name: string }];
	"user:logout": [{ id: string }];
	message: [{ text: string; from: string }];
};

const emitter = new EventEmitter<MyEvents>();

// Type-safe event handling
emitter.on("user:login", (user) => {
	// TypeScript knows that user has { id: string; name: string }
	console.log(`User ${user.name} logged in`);
});

emitter.on("message", (message) => {
	// TypeScript knows that message has { text: string; from: string }
	console.log(`${message.from}: ${message.text}`);
});

// Type-safe event emission
emitter.emit("user:login", { id: "123", name: "John" }); // ✅ OK
emitter.emit("message", { text: "Hello", from: "John" }); // ✅ OK

// Type errors:
// @ts-expect-error
emitter.emit("user:login", { id: "123" }); // ❌ Error: missing 'name' property
// @ts-expect-error
emitter.emit("unknown-event", {}); // ❌ Error: unknown event
emitter.on("user:logout", (user) => {
	// @ts-expect-error
	console.log(user.name); // ❌ Error: 'name' doesn't exist on type '{ id: string }'
});
