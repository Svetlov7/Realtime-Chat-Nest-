import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { userRoom } from '../common/realtime/rooms.js';

export interface RealtimeTarget {
  userIds?: string[];
  rooms?: string[];
  /** Emit to every connected socket; `userIds` and `rooms` are ignored. */
  broadcast?: true;
  /** User ids whose sockets must not receive the event. */
  except?: string[];
}

/**
 * Transport-only emitter: delivers any event to users, rooms or everyone.
 * Never throws, so a socket failure can't break the request that triggered it.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server?: Server;

  bindServer(server: Server): void {
    this.server = server;
    this.logger.log('Socket.io server bound');
  }

  emitToUser(
    userId: string | string[],
    event: string,
    payload?: unknown,
  ): void {
    this.emit({ userIds: toArray(userId) }, event, payload);
  }

  emitToRoom(room: string | string[], event: string, payload?: unknown): void {
    this.emit({ rooms: toArray(room) }, event, payload);
  }

  emitToAll(event: string, payload?: unknown): void {
    this.emit({ broadcast: true }, event, payload);
  }

  emit(target: RealtimeTarget, event: string, payload?: unknown): void {
    const rooms = [
      ...(target.userIds ?? []).map(userRoom),
      ...(target.rooms ?? []),
    ];
    const except = (target.except ?? []).map(userRoom);
    const targetLabel = describeTarget(target.broadcast, rooms, except);

    if (!this.server) {
      this.logger.warn(
        `Dropped "${event}" (${targetLabel}): server is not bound yet`,
      );
      return;
    }
    if (!target.broadcast && rooms.length === 0) {
      this.logger.warn(`Skipped "${event}": no target rooms`);
      return;
    }

    try {
      const operator = target.broadcast ? this.server : this.server.to(rooms);
      const scoped = except.length > 0 ? operator.except(except) : operator;
      scoped.emit(event, payload);
      this.logger.debug(
        `Emitted "${event}" (${targetLabel}, payload=${payloadSize(payload)}B)`,
      );
    } catch (error) {
      this.logger.error(`Failed to emit "${event}" (${targetLabel})`, error);
    }
  }

  joinRoom(userId: string, room: string): void {
    this.changeMembership('join', userId, room);
  }

  leaveRoom(userId: string, room: string): void {
    this.changeMembership('leave', userId, room);
  }

  /** Makes every socket leave the room, e.g. when the resource behind it is deleted. */
  clearRoom(room: string): void {
    if (!this.server) {
      this.logger.warn(`Skipped clearing "${room}": server is not bound yet`);
      return;
    }
    try {
      this.server.in(room).socketsLeave(room);
      this.logger.debug(`Cleared "${room}"`);
    } catch (error) {
      this.logger.error(`Failed to clear "${room}"`, error);
    }
  }

  private changeMembership(
    action: 'join' | 'leave',
    userId: string,
    room: string,
  ): void {
    if (!this.server) {
      this.logger.warn(
        `Skipped ${action} of user ${userId} to "${room}": server is not bound yet`,
      );
      return;
    }
    try {
      const sockets = this.server.in(userRoom(userId));
      if (action === 'join') {
        sockets.socketsJoin(room);
      } else {
        sockets.socketsLeave(room);
      }
      this.logger.debug(`User ${userId} sockets ${action} "${room}"`);
    } catch (error) {
      this.logger.error(
        `Failed to ${action} user ${userId} to "${room}"`,
        error,
      );
    }
  }
}

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function describeTarget(
  broadcast: true | undefined,
  rooms: string[],
  except: string[],
): string {
  const base = broadcast ? 'broadcast' : `rooms=[${rooms.join(',')}]`;
  return except.length > 0 ? `${base}, except=[${except.join(',')}]` : base;
}

// Payloads may carry private content, so only their size is logged.
function payloadSize(payload: unknown): number {
  if (payload === undefined) {
    return 0;
  }
  try {
    return Buffer.byteLength(JSON.stringify(payload) ?? '');
  } catch {
    return -1;
  }
}
