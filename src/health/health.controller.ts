import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @ApiOperation({ summary: 'Estado de la API y de la conexion con MongoDB' })
  @Public()
  @Get()
  async getHealth(): Promise<{ status: string; database: string; timestamp: string }> {
    try {
      await this.connection.db?.admin().ping();
    } catch {
      throw new ServiceUnavailableException('MongoDB no responde');
    }

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
