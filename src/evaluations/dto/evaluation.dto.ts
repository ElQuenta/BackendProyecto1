import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateEvaluationDto {
  @ApiProperty({ description: 'ID del grupo' })
  @IsMongoId()
  group!: string;

  @ApiProperty({ example: 'Parcial 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ minimum: 1, maximum: 100, example: 25, description: 'Porcentaje de la nota final' })
  @IsNumber()
  @Min(1)
  @Max(100)
  weight!: number;
}

// El grupo no se puede cambiar una vez creada la evaluacion
export class UpdateEvaluationDto extends PartialType(OmitType(CreateEvaluationDto, ['group'] as const)) {}

export class EvaluationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por grupo' })
  @IsOptional()
  @IsMongoId()
  group?: string;
}
