import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// username e fixo (vira URL); e-mail e senha mudam por /account, com confirmacao
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  // so serve para tirar a foto: um endereco de fora deixaria aquele site ver quem abre cada perfil
  @IsOptional()
  @IsIn([''])
  avatarUrl?: string;
}
