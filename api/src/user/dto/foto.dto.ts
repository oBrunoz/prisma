import { Transform, plainToInstance } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

// como a foto foi enquadrada no circulo: zoom e deslocamento em diametros do circulo
export class EnquadramentoDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(4)
  zoom: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-10)
  @Max(10)
  x: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-10)
  @Max(10)
  y: number;

  @IsIn([0, 90, 180, 270])
  giro: number;
}

// no multipart o enquadramento chega como texto JSON
export class FotoDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return plainToInstance(EnquadramentoDto, JSON.parse(value));
    } catch {
      return value;
    }
  })
  @ValidateNested()
  enquadramento?: EnquadramentoDto;
}
