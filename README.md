# safe-event-emitter-ts

End-To-End type safe EventEmitter implementation for TypeScript.

- Type-safe event handling
- Generic event listener support
- Event propagation
- Easy integration with different components

## `EventEmitter` class

The EventEmitter class is designed to handle custom events with type safety. Here’s how to use it:

```typescript
// Define custom event types
type CustomEventA = {
    value: number;
};

type CustomEventB = {
    message: string;
};

// Define the event map
type CustomEvents = {
    eventA: (type: "eventA", payload: CustomEventA) => void;
    eventB: (type: "eventB", payload: CustomEventB) => void;
};

// Create an instance of EventEmitter
const eventEmitter = new EventEmitter<CustomEvents>();

// Add event listeners
eventEmitter.addEventListener("eventA", (type, payload) => {
    console.log(`Event: ${type}, Value: ${payload.value}`);
});

eventEmitter.addEventListener("eventB", (type, payload) => {
    console.log(`Event: ${type}, Message: ${payload.message}`);
});

// Dispatch events
eventEmitter.dispatch("eventA", { value: 42 });
eventEmitter.dispatch("eventB", { message: "Hello, World!" });

```

Or you can create a custom event emitter class:

```typescript
type CustomEventA = {
    value: number;
};

type CustomEventB = {
    message: string;
};

type CustomEvents = {
    eventA: (type: "eventA", payload: CustomEventA) => void;
    eventB: (type: "eventB", payload: CustomEventB) => void;
};

class CustomEventEmitter extends EventEmitter<CustomEvents> {
    constructor() {
        super();
    }

    dispatchEventA(value: number) {
        this.dispatch("eventA", { value });
    }

    dispatchEventB(message: string) {
        this.dispatch("eventB", { message });
    }
}
```
