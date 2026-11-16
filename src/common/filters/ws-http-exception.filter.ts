import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

/**
 * The global ValidationPipe also runs for gateways and throws HttpExceptions,
 * which the default WS filter reports as "Internal server error". Convert them
 * so clients get the real message in the `exception` event.
 */
@Catch()
export class WsHttpExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: unknown }).message ?? exception.message);
      super.catch(new WsException({ status: 'error', message }), host);
      return;
    }
    super.catch(exception, host);
  }
}
