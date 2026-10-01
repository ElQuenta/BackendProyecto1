import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Paginated, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';
import { Teacher } from './schemas/teacher.schema';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateTeacherDto): Promise<Teacher> {
    return this.teachersService.create(dto);
  }

  @Roles(Role.Admin)
  @Get()
  findAll(@Query() query: PaginationQueryDto): Promise<Paginated<Teacher>> {
    return this.teachersService.findAll(query);
  }

  // Debe ir antes de ':id' para que 'me' no se interprete como un ID
  @Roles(Role.Docente)
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<Teacher> {
    return this.teachersService.findByUserId(user.id);
  }

  @Roles(Role.Admin)
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<Teacher> {
    return this.teachersService.findOne(id);
  }

  @Roles(Role.Admin)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTeacherDto,
  ): Promise<Teacher> {
    return this.teachersService.update(id, dto);
  }
}
