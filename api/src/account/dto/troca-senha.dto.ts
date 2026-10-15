import { IsString, MaxLength, MinLength } from 'class-validator';

export class TrocaSenhaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  // mesmas regras do cadastro
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
