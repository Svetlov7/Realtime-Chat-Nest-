import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './core/database/database.module.js';
import { ControllersModule } from './controllers/controllers.module.js';
import { GatewaysModule } from './gateways/gateways.module.js';
import { ListenersModule } from './listeners/listeners.module.js';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DatabaseModule,
    ControllersModule,
    GatewaysModule,
    ListenersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
