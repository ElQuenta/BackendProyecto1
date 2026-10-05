import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean } from '../../common/dto/query-helpers';

export class CreateProgramDto {
  @ApiProperty({ example: 'ISIS' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Ingenieria de Sistemas' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 160, description: 'Creditos totales del programa' })
  @IsInt()
  @Min(1)
  totalCredits!: number;

  @ApiPropertyOptional({ description: 'ID de la facultad a la que pertenece' })
  @IsOptional()
  @IsMongoId()
  faculty?: string;
}

export class UpdateProgramDto extends PartialType(CreateProgramDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ProgramsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca en codigo y nombre' })
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
