import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { EnrollmentStatus } from '../schemas/enrollment.schema';

export class CreateEnrollmentDto {
  @ApiProperty({ description: 'ID del grupo en el que se matricula' })
  @IsMongoId()
  groupId!: string;

  @ApiPropertyOptional({ description: 'ID del estudiante. Solo lo usa el admin; el estudiante se matricula a si mismo' })
  @IsOptional()
  @IsMongoId()
  student?: string;
}

export class EnrollmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estudiante' })
  @IsOptional()
  @IsMongoId()
  student?: string;

  @ApiPropertyOptional({ description: 'Filtrar por grupo' })
  @IsOptional()
  @IsMongoId()
  group?: string;

  @ApiPropertyOptional({ description: 'Filtrar por periodo' })
  @IsOptional()
  @IsMongoId()
  period?: string;

  @ApiPropertyOptional({ enum: EnrollmentStatus })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
