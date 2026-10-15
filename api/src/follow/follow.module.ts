import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UserModule } from '../user/user.module.js';
import { FollowController } from './follow.controller.js';
import { FollowService } from './follow.service.js';

@Module({
  imports: [AuthModule, UserModule],
  controllers: [FollowController],
  providers: [FollowService],
})
export class FollowModule {}
