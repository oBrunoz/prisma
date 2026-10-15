import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// so o que aparece no perfil. O username e fixo (vira URL e e como acham a
// pessoa); e-mail e senha mudam por /account, com confirmacao
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

  // so serve para tirar a foto. Foto nova vem por upload: um endereco de fora
  // deixaria aquele site ver quem abre cada perfil
  @IsOptional()
  @IsIn([''])
  avatarUrl?: string;
}
