import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ description: 'ID del usuario (rol docente)' })
  @IsMongoId()
  user!: string;

  @ApiProperty({ example: 'DOC-001' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Ingenieria' })
  @IsString()
  @IsNotEmpty()
  department!: string;
}

export class UpdateTeacherDto extends PartialType(OmitType(CreateTeacherDto, ['user'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
