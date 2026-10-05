import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateFacultyDto {
  @ApiProperty({ example: 'FAC-BOG-ING' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Facultad de Ingeniería' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Bogotá' })
  @IsString()
  @IsNotEmpty()
  campus!: string;

  @ApiPropertyOptional({ description: 'ID del docente que es decano' })
  @IsOptional()
  @IsMongoId()
  dean?: string;

  @ApiPropertyOptional({ example: 'ingenieria.bogota@universidad.edu' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateFacultyDto extends PartialType(CreateFacultyDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class FacultiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Bogotá', description: 'Filtrar por sede' })
  @IsOptional()
  @IsString()
  campus?: string;
}
