import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PeriodStatus } from '../schemas/period.schema';

export class CreatePeriodDto {
  @ApiProperty({ example: '2026-2' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-15' })
  @IsDateString()
  endDate!: string;
}

export class UpdatePeriodDto extends PartialType(CreatePeriodDto) {
  @ApiPropertyOptional({ enum: PeriodStatus })
  @IsOptional()
  @IsEnum(PeriodStatus)
  status?: PeriodStatus;
}
