import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

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
}

export class UpdateProgramDto extends PartialType(CreateProgramDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
