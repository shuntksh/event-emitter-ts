# safe-event-emitter-ts

A fully type-safe EventEmitter implementation for TypeScript with API similar to Node.js EventEmitter.

## Features

- 🔒 Full TypeScript type safety for events and their payloads
- 🔄 API compatible with Node.js EventEmitter
- 🌳 Support for wildcard event patterns (optional)
- ⚡ Async event handling support
- 🎯 Zero dependencies
- 💪 Robust error handling

## Installation

```bash
# Using bun
bun add safe-event-emitter-ts
```

## Basic Usage

```typescript
import { EventEmitter } from 'safe-event-emitter-ts';

// Define your event map with type-safe event names and parameters
interface MyEvents {
  userJoined: [username: string, timestamp: number];
  userLeft: [username: string];
  messageReceived: [message: string, from: string];
}

// Create a type-safe event emitter instance
const emitter = new EventEmitter<MyEvents>();

// Add event listeners with full type safety
emitter.on('userJoined', (username, timestamp) => {
  console.log(`${username} joined at ${new Date(timestamp)}`);
});

emitter.on('messageReceived', (message, from) => {
  console.log(`${from}: ${message}`);
});

// Emit events with type checking
emitter.emit('userJoined', 'Alice', Date.now()); // ✅ Valid
emitter.emit('messageReceived', 'Hello!', 'Bob'); // ✅ Valid
emitter.emit('userJoined', 'Alice'); // ❌ Type error: missing timestamp
```

## Advanced Features

### Wildcard Event Patterns

```typescript
// Enable wildcard support in constructor
const emitter = new EventEmitter<MyEvents>({ useWildcards: true });

// Listen to all events matching a pattern
emitter.on('user*', (username) => {
  console.log('User event occurred:', username);
});

// Use deep wildcards
emitter.on('chat.**', (...args) => {
  console.log('Chat related event:', ...args);
});
```

### Async Event Handling

```typescript
// Async event handler
emitter.on('messageReceived', async (message, from) => {
  await saveToDatabase(message, from);
}, { promisify: true });

// Emit and wait for all handlers
await emitter.emitAsync('messageReceived', 'Hello!', 'Alice');
```

### Once Listeners

```typescript
// Listen for an event only once
emitter.once('userJoined', (username, timestamp) => {
  console.log(`First user ${username} joined!`);
});
```

## Node.js EventEmitter Compatibility

This package implements an API similar to Node.js EventEmitter, making it familiar for Node.js developers. Key differences include:

- Full TypeScript type safety
- Optional wildcard event support
- Built-in async event handling
- More robust error handling

Common methods like `on()`, `once()`, `emit()`, and `off()` work the same way as in Node.js EventEmitter.

## Configuration Options

```typescript
const emitter = new EventEmitter<MyEvents>({
  useWildcards: false,         // Enable/disable wildcard support
  namespaceDelimiter: '.',     // Delimiter for event namespaces
  emitNewListener: false,      // Emit 'newListener' events
  emitRemoveListener: false,   // Emit 'removeListener' events
  maxHandlers: 10,             // Max listeners per event
  suppressErrors: false,       // Suppress error events
  detailedLeakWarnings: true   // Show detailed memory leak warnings
});
```

## License

MIT
