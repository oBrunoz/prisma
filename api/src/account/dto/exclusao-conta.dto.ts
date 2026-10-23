import { IsString, MaxLength, MinLength } from 'class-validator';

export class ExclusaoContaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;
}
