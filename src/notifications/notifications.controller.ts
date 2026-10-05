import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Paginated } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateNotificationDto, NotificationsQueryDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { Notification } from './schemas/notification.schema';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Enviar un aviso a un usuario' })
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsService.create(dto);
  }

  // Cualquier usuario autenticado ve SUS notificaciones
  @ApiOperation({ summary: 'Mis notificaciones (con contador de no leidas)' })
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: NotificationsQueryDto): Promise<Paginated<Notification> & { unread: number }> {
    return this.notificationsService.findMine(user.id, query);
  }

  // Debe ir antes de ':id/read' para que 'read-all' no se interprete como un ID
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leidas' })
  @Patch('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'Marcar una notificacion como leida' })
  @Patch(':id/read')
  read(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser): Promise<Notification> {
    return this.notificationsService.markRead(id, user.id);
  }
}
