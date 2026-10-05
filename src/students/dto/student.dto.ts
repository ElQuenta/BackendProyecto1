import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean } from '../../common/dto/query-helpers';

export class CreateStudentDto {
  @ApiProperty({ description: 'ID del usuario (rol estudiante)' })
  @IsMongoId()
  user!: string;

  @ApiProperty({ example: '2026001' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'ID del programa' })
  @IsMongoId()
  program!: string;
}

export class UpdateStudentDto extends PartialType(OmitType(CreateStudentDto, ['user'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class StudentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca en codigo, nombre y correo' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filtrar por programa' })
  @IsOptional()
  @IsMongoId()
  program?: string;

  @ApiPropertyOptional({ description: 'true = activos, false = inactivos' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}
