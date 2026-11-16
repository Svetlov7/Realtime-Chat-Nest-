import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { RealtimeService } from './realtime.service.js';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let operator: {
    except: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };
  let sockets: {
    socketsJoin: ReturnType<typeof vi.fn>;
    socketsLeave: ReturnType<typeof vi.fn>;
  };
  let server: {
    to: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    except: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    operator = { except: vi.fn(), emit: vi.fn() };
    operator.except.mockReturnValue(operator);
    sockets = { socketsJoin: vi.fn(), socketsLeave: vi.fn() };
    server = {
      to: vi.fn().mockReturnValue(operator),
      in: vi.fn().mockReturnValue(sockets),
      except: vi.fn().mockReturnValue(operator),
      emit: vi.fn(),
    };
    service = new RealtimeService();
    service.bindServer(server as unknown as Server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops events emitted before the server is bound', () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const unbound = new RealtimeService();

    expect(() => unbound.emitToUser('u1', 'test', {})).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it('emits to user rooms', () => {
    service.emitToUser(['u1', 'u2'], 'test', { a: 1 });

    expect(server.to).toHaveBeenCalledWith(['user:u1', 'user:u2']);
    expect(operator.emit).toHaveBeenCalledWith('test', { a: 1 });
  });

  it('combines users and rooms and excludes users', () => {
    service.emit(
      { userIds: ['u1'], rooms: ['room'], except: ['u3'] },
      'test',
      null,
    );

    expect(server.to).toHaveBeenCalledWith(['user:u1', 'room']);
    expect(operator.except).toHaveBeenCalledWith(['user:u3']);
    expect(operator.emit).toHaveBeenCalledWith('test', null);
  });

  it('broadcasts to everyone', () => {
    service.emitToAll('test', 'hi');

    expect(server.to).not.toHaveBeenCalled();
    expect(server.emit).toHaveBeenCalledWith('test', 'hi');
  });

  it('skips emits without targets', () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    service.emitToUser([], 'test');

    expect(server.to).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('swallows and logs transport errors', () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    operator.emit.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => service.emitToRoom('room', 'test')).not.toThrow();
    expect(error).toHaveBeenCalled();
  });

  it('moves all sockets of a user into and out of a room', () => {
    service.joinRoom('u1', 'room');
    service.leaveRoom('u1', 'room');

    expect(server.in).toHaveBeenCalledWith('user:u1');
    expect(sockets.socketsJoin).toHaveBeenCalledWith('room');
    expect(sockets.socketsLeave).toHaveBeenCalledWith('room');
  });

  it('removes every socket from a room', () => {
    service.clearRoom('conversation:c1');

    expect(server.in).toHaveBeenCalledWith('conversation:c1');
    expect(sockets.socketsLeave).toHaveBeenCalledWith('conversation:c1');
  });
});
