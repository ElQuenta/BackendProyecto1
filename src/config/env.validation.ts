import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsString()
  @MinLength(16)
  JWT_SECRET!: string;

  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN_SECONDS: number = 3600;

  @IsEmail()
  ADMIN_EMAIL!: string;

  @IsString()
  @MinLength(8)
  ADMIN_PASSWORD!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated);

  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Variables de entorno invalidas -> ${details}`);
  }

  return validated;
}
