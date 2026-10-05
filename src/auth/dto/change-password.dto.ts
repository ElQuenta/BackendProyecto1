import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../../users/dto/create-user.dto';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: 8, example: 'NuevaClave123', description: 'Minimo 8 caracteres, con letras y numeros' })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
