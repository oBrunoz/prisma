import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
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

  // string vazia limpa a foto; qualquer outra coisa precisa ser uma URL
  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string;
}
