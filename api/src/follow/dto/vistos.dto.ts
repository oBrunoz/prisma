import { IsDateString } from 'class-validator';

export class VistosDto {
  // o mais recente que a pessoa viu: o que chegar depois continua novo
  @IsDateString()
  ate: string;
}
