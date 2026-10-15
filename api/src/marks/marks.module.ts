import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MarksController } from './marks.controller.js';
import { MarksService } from './marks.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MarksController],
  providers: [MarksService],
})
export class MarksModule {}
