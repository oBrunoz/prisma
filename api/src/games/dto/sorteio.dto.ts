import { IsEnum, IsOptional, Matches } from 'class-validator';
import { GameKind } from '../../generated/prisma/enums.js';

// o front lembra os sorteados da visita; acima disso é abuso
export const MAX_EXCETO = 50;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export class SorteioDto {
  @IsEnum(GameKind)
  kind: GameKind;

  // ids dos desafios já sorteados, separados por vírgula, do mais antigo ao mais recente
  @IsOptional()
  @Matches(new RegExp(`^${UUID}(,${UUID}){0,${MAX_EXCETO - 1}}$`), {
    message: `exceto deve listar até ${MAX_EXCETO} ids separados por vírgula`,
  })
  exceto?: string;
}
