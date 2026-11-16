import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module.js';
import { ChatRealtimeListener } from './chat-realtime.listener.js';

@Module({
  imports: [ServicesModule],
  providers: [ChatRealtimeListener],
})
export class ListenersModule {}
