import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean } from '../../common/dto/query-helpers';

export class CreateTeacherDto {
  @ApiProperty({ description: 'ID del usuario (rol docente)' })
  @IsMongoId()
  user!: string;

  @ApiProperty({ example: 'DOC-001' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'ID de la facultad a la que pertenece' })
  @IsMongoId()
  faculty!: string;
}

export class UpdateTeacherDto extends PartialType(OmitType(CreateTeacherDto, ['user'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class TeachersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca en codigo, nombre y correo' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filtrar por facultad' })
  @IsOptional()
  @IsMongoId()
  faculty?: string;

  @ApiPropertyOptional({ description: 'true = activos, false = inactivos' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}
