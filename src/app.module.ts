import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './core/database/database.module.js';
import { ControllersModule } from './controllers/controllers.module.js';

@Module({
  imports: [DatabaseModule, ControllersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
