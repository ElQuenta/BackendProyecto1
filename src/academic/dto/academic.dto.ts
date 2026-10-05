import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { toBoolean } from '../../common/dto/query-helpers';
import { EnrollmentStatus } from '../../enrollments/schemas/enrollment.schema';

// Los horarios se consultan por periodo; si no se indica, se usa el periodo abierto
export class ScheduleQueryDto {
  @ApiPropertyOptional({ description: 'ID del periodo (por defecto, el periodo abierto)' })
  @IsOptional()
  @IsMongoId()
  period?: string;
}

export class AvailableQueryDto {
  @ApiPropertyOptional({ description: 'true = incluir grupos de otros programas' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  all?: boolean;
}

export class RosterQueryDto {
  @ApiPropertyOptional({ enum: EnrollmentStatus, description: 'Por defecto trae todas menos las canceladas' })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
