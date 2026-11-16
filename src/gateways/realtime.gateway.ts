import { Logger, UseFilters } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { WsHttpExceptionFilter } from '../common/filters/ws-http-exception.filter.js';
import {
  RealtimeEvent,
  type ConversationTypingPayload,
} from '../common/realtime/events.js';
import { conversationRoom, userRoom } from '../common/realtime/rooms.js';
import type { AuthenticatedSocket } from '../common/types/authenticated-socket.js';
import { TypingDto } from '../dto/realtime/index.js';
import { AuthService } from '../services/auth.service.js';
import { ConversationsService } from '../services/conversations.service.js';
import { RealtimeService } from '../services/realtime.service.js';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
@UseFilters(new WsHttpExceptionFilter())
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly conversationsService: ConversationsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    // Middleware runs before the connection is accepted, so rejected clients
    // get `connect_error` instead of a brief connect followed by a disconnect.
    server.use((client, next) => {
      this.authenticate(client as AuthenticatedSocket)
        .then(next)
        .catch((error: unknown) => {
          this.logger.error('Unexpected error during socket auth', error);
          next(new Error('Unauthorized'));
        });
    });
    this.realtimeService.bindServer(server);
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const { userId } = client.data;
    try {
      const conversations =
        await this.conversationsService.findAllForUser(userId);
      await client.join([
        userRoom(userId),
        ...conversations.map((conversation) =>
          conversationRoom(conversation.id),
        ),
      ]);
      this.logger.log(
        `Socket ${client.id} connected (user ${userId}, ${conversations.length} conversations)`,
      );
    } catch (error) {
      // Without its rooms the socket would silently miss events, so drop it.
      this.logger.error(`Failed to set up socket ${client.id}`, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket, reason?: string): void {
    this.logger.log(
      `Socket ${client.id} disconnected (user ${client.data.userId}, reason: ${reason ?? 'unknown'})`,
    );
  }

  @SubscribeMessage(RealtimeEvent.ConversationTyping)
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: TypingDto,
  ): void {
    const { userId } = client.data;
    const room = conversationRoom(dto.conversationId);
    // Room membership mirrors conversation membership, so no DB query per keystroke.
    if (!client.rooms.has(room)) {
      this.logger.warn(
        `User ${userId} sent typing to ${room} without being a member`,
      );
      throw new WsException('You are not a member of this conversation');
    }
    this.realtimeService.emit(
      { rooms: [room], except: [userId] },
      RealtimeEvent.ConversationTyping,
      {
        conversationId: dto.conversationId,
        userId,
        isTyping: dto.isTyping,
      } satisfies ConversationTypingPayload,
    );
  }

  private async authenticate(
    client: AuthenticatedSocket,
  ): Promise<Error | undefined> {
    const token = extractToken(client);
    if (!token) {
      return this.reject(client, 'missing token');
    }
    try {
      const { userId } = await this.authService.verifyAccessToken(token);
      client.data.userId = userId;
      return undefined;
    } catch (error) {
      return this.reject(client, (error as Error).message);
    }
  }

  private reject(client: AuthenticatedSocket, reason: string): Error {
    this.logger.warn(`Socket ${client.id} rejected: ${reason}`);
    return new Error('Unauthorized');
  }
}

function extractToken(client: AuthenticatedSocket): string | undefined {
  const authToken: unknown = client.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }
  const header = client.handshake.headers.authorization;
  const [scheme, value] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}
