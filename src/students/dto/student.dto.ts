import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
