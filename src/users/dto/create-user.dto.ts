import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Lopez' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'maria@universidad.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Clave12345' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: Role, default: Role.Estudiante })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
