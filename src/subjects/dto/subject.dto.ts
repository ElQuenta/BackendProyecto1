import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean } from '../../common/dto/query-helpers';

export class CreateSubjectDto {
  @ApiProperty({ example: 'BD101' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Bases de Datos' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ minimum: 1, maximum: 10, example: 3 })
  @IsInt()
  @Min(1)
  @Max(10)
  credits!: number;

  @ApiProperty({ description: 'ID del programa' })
  @IsMongoId()
  program!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @ApiPropertyOptional({ type: [String], description: 'IDs de materias prerrequisito' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  prerequisites?: string[];
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SubjectsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por programa' })
  @IsOptional()
  @IsMongoId()
  program?: string;

  @ApiPropertyOptional({ description: 'Busca en codigo y nombre' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, description: 'Filtrar por semestre' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @ApiPropertyOptional({ description: 'true = activas, false = inactivas' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}
