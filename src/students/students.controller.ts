import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Paginated } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateStudentDto, StudentsQueryDto, UpdateStudentDto } from './dto/student.dto';
import { Student } from './schemas/student.schema';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @ApiOperation({ summary: 'Crear un estudiante' })
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateStudentDto): Promise<Student> {
    return this.studentsService.create(dto);
  }

  @ApiOperation({ summary: 'Listar estudiantes (filtros: q, program, active)' })
  @Roles(Role.Admin, Role.Docente)
  @Get()
  findAll(@Query() query: StudentsQueryDto): Promise<Paginated<Student>> {
    return this.studentsService.findAll(query);
  }

  // Debe ir antes de ':id' para que 'me' no se interprete como un ID
  @ApiOperation({ summary: 'Mi perfil de estudiante' })
  @Roles(Role.Estudiante)
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<Student> {
    return this.studentsService.findByUserId(user.id);
  }

  @ApiOperation({ summary: 'Ver un estudiante por ID' })
  @Roles(Role.Admin, Role.Docente)
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<Student> {
    return this.studentsService.findOne(id);
  }

  @ApiOperation({ summary: 'Editar un estudiante' })
  @Roles(Role.Admin)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<Student> {
    return this.studentsService.update(id, dto);
  }
}
