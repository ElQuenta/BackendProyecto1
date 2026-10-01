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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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
}
