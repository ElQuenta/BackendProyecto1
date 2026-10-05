import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

// Politica de contrasenas: minimo 8 caracteres, con al menos una letra y un numero
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_MESSAGE = 'La contrasena debe incluir letras y numeros';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Lopez' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'maria@universidad.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Clave12345', description: 'Minimo 8 caracteres, con letras y numeros' })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiPropertyOptional({ enum: Role, default: Role.Estudiante })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
