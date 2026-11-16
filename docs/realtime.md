# Realtime events

The API pushes chat updates over socket.io on the same port as REST. Sockets are only a notification channel: every change is made through REST, and the database stays the source of truth.

## Connecting

Pass the access token from `POST /auth/login` in the handshake:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  // A function, so every reconnect sends the current token rather than an expired one.
  auth: (cb) => cb({ token: getAccessToken() }),
});

socket.on('connect_error', (err) => {
  // err.message === 'Unauthorized': missing, invalid or expired token
});
```

The `Authorization: Bearer <token>` header also works for non-browser clients. The token is only checked at connect time. A socket stays connected after its token expires, and the next reconnect needs a fresh token.

## Events (server → client)

Event names and payload types live in `src/common/realtime/events.ts`.

| Event | Who receives it | Payload |
|---|---|---|
| `conversation:joined` | Users who just gained access: every member on create, new members on add | `{ conversation }` |
| `conversation:members-added` | All members, including the new ones | `{ conversationId, userIds, addedBy }` |
| `conversation:deleted` | All members | `{ conversationId, deletedBy }` |
| `message:created` | All members, **including the sender** | the same `MessageResponse` that `POST /messages` returns |
| `conversation:typing` | All members except the typing user (on any of their devices) | `{ conversationId, userId, isTyping }` |
| `exception` | The socket whose message was rejected | `{ status: 'error', message }` |

The sender receives `message:created` so their other devices see the message. The tab that sent it gets the message twice (HTTP response and event), so deduplicate by `message.id`. The same applies to `conversation:joined` for the creator.

## Typing (client → server)

```ts
socket.emit('conversation:typing', { conversationId, isTyping: true });
```

- Send `isTyping: true` at most once every ~3 s while the user types, and `false` when they stop or send the message.
- The server keeps no typing state. Receivers should hide the indicator on `false` or after ~5 s without updates, which also covers a sender that disconnected.
- Sending to a conversation you are not a member of, or an invalid payload, returns an `exception` event.

## Missed events

Events are not stored or retried. A client that was offline, or lost its connection, should reload conversations and messages through REST after every `connect`.

## Server side

```
REST controller → domain service → DB write → EventEmitter2 (DomainEvent.*)
                                                   ↓
                         listeners/chat-realtime.listener.ts → RealtimeService → socket.io rooms
```

- Rooms: `user:<id>` holds all sockets of a user, and `conversation:<id>` holds the sockets of all members. On connect a socket joins its user room and the rooms of all its active conversations. The listener adds sockets on create and add, and empties the room on delete.
- Domain services only publish `DomainEvent` constants from `src/common/events/domain-events.ts`, after the write succeeds. Add a listener to react to the same events in other ways (push notifications, counters).
- Typing is not a domain event: the gateway relays it directly and checks membership via the socket's rooms, so it costs no database query.
- Rooms live in process memory. Running several API instances needs the socket.io Redis adapter.
