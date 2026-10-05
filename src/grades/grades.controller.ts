import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Paginated } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { BulkGradesDto, GradesQueryDto, UpsertGradeDto } from './dto/grade.dto';
import { GradesService } from './grades.service';
import { Grade } from './schemas/grade.schema';

@ApiTags('grades')
@ApiBearerAuth()
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  // Crea la nota, o la corrige si ya existia (idempotente)
  @ApiOperation({ summary: 'Registrar o corregir una nota (idempotente)' })
  @Roles(Role.Admin, Role.Docente)
  @Put()
  upsert(@Body() dto: UpsertGradeDto, @CurrentUser() user: AuthUser): Promise<Grade> {
    return this.gradesService.upsert(dto, user);
  }

  // Debe ir antes de cualquier ruta con parametro; PUT /grades/bulk no choca con PUT /grades
  @ApiOperation({ summary: 'Registrar varias notas a la vez (planilla); informa las que fallaron' })
  @Roles(Role.Admin, Role.Docente)
  @Put('bulk')
  bulk(@Body() dto: BulkGradesDto, @CurrentUser() user: AuthUser) {
    return this.gradesService.bulkUpsert(dto, user);
  }

  @ApiOperation({ summary: 'Consultar notas de una matricula o de una evaluacion' })
  @Roles(Role.Admin, Role.Docente)
  @Get()
  findAll(@Query() query: GradesQueryDto, @CurrentUser() user: AuthUser): Promise<Paginated<Grade>> {
    return this.gradesService.findAll(query, user);
  }

  @ApiOperation({ summary: 'Mis notas' })
  @Roles(Role.Estudiante)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: GradesQueryDto): Promise<Paginated<Grade>> {
    return this.gradesService.findMine(user.id, query);
  }

  @ApiOperation({ summary: 'Calcular la nota final de una matricula y marcarla aprobada/reprobada' })
  @Roles(Role.Admin, Role.Docente)
  @Post('finalize/:enrollmentId')
  @HttpCode(200)
  finalize(
    @Param('enrollmentId', ParseObjectIdPipe) enrollmentId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ id: string; finalGrade: number; status: EnrollmentStatus }> {
    return this.gradesService.finalize(enrollmentId, user);
  }
}
