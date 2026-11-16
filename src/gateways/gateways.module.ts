import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [ServicesModule],
  providers: [RealtimeGateway],
})
export class GatewaysModule {}
