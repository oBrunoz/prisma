import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaModule } from '../media/media.module.js';
import { TmdbModule } from '../tmdb/tmdb.module.js';
import { AvatarService } from './avatar.service.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

@Module({
  // o guard precisa do JwtService, e o AuthModule ja depende daqui: forwardRef
  // quebra o ciclo sem duplicar a configuracao do JWT
  imports: [forwardRef(() => AuthModule), MediaModule, TmdbModule],
  controllers: [UserController],
  providers: [UserService, AvatarService],
  exports: [UserService],
})
export class UserModule {}
