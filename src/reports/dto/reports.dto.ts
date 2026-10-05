import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

// Los reportes se calculan sobre un periodo; si no se indica, se usa el periodo abierto
export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'ID del periodo (por defecto, el periodo abierto)' })
  @IsOptional()
  @IsMongoId()
  period?: string;

  @ApiPropertyOptional({ description: 'Limitar a un programa' })
  @IsOptional()
  @IsMongoId()
  program?: string;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100, description: 'Cantidad de filas (rankings)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Minimo de materias reprobadas (estudiantes en riesgo)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minFailed: number = 1;
}
