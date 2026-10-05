import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ReportQueryDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

// Reportes de gestion: solo el administrador
@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Tablero general: conteos del sistema y estado del periodo abierto' })
  @Get('dashboard')
  dashboard() {
    return this.reportsService.dashboard();
  }

  @ApiOperation({ summary: 'Matriculas y estudiantes por programa en un periodo' })
  @Get('enrollments-by-program')
  enrollmentsByProgram(@Query() query: ReportQueryDto) {
    return this.reportsService.enrollmentsByProgram(query);
  }

  @ApiOperation({ summary: 'Ocupacion de los grupos (los mas llenos primero)' })
  @Get('group-occupancy')
  groupOccupancy(@Query() query: ReportQueryDto) {
    return this.reportsService.groupOccupancy(query);
  }

  @ApiOperation({ summary: 'Aprobacion y promedio por materia (las de menor aprobacion primero)' })
  @Get('subject-performance')
  subjectPerformance(@Query() query: ReportQueryDto) {
    return this.reportsService.subjectPerformance(query);
  }

  @ApiOperation({ summary: 'Mejores promedios del periodo (ponderados por creditos)' })
  @Get('top-students')
  topStudents(@Query() query: ReportQueryDto) {
    return this.reportsService.topStudents(query);
  }

  @ApiOperation({ summary: 'Estudiantes con materias reprobadas en el periodo' })
  @Get('at-risk-students')
  atRiskStudents(@Query() query: ReportQueryDto) {
    return this.reportsService.atRiskStudents(query);
  }

  @ApiOperation({ summary: 'Carga docente: grupos, estudiantes y creditos por docente' })
  @Get('teacher-load')
  teacherLoad(@Query() query: ReportQueryDto) {
    return this.reportsService.teacherLoad(query);
  }

  @ApiOperation({ summary: 'Programas, docentes y estudiantes por facultad' })
  @Get('faculty-summary')
  facultySummary() {
    return this.reportsService.facultySummary();
  }
}
