import { Matches } from 'class-validator';

export class ConfirmacaoEmailDto {
  @Matches(/^\d{6}$/, { message: 'code precisa ter 6 digitos' })
  code: string;
}
