import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { Enrollment, EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { Evaluation, EvaluationDocument } from '../evaluations/schemas/evaluation.schema';
import { Grade, GradeDocument } from '../grades/schemas/grade.schema';
import { GradesService } from '../grades/grades.service';
import { GroupsService } from '../groups/groups.service';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { PeriodsService } from '../periods/periods.service';
import { Program, ProgramDocument } from '../programs/schemas/program.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';

const DAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Formas (parciales) de los documentos ya poblados. Se leen con lean() para no cargar documentos completos de Mongoose
interface Named {
  _id: Types.ObjectId;
  code?: string;
  name?: string;
  credits?: number;
  user?: { name?: string; email?: string };
}
interface PopulatedGroup {
  _id: Types.ObjectId;
  number: number;
  capacity: number;
  enrolled: number;
  active: boolean;
  subject: Named;
  period: { _id: Types.ObjectId; code: string; status: string };
  teacher: Named;
  schedule: { day: string; startTime: string; endTime: string; classroom: { code?: string; building?: string } }[];
}
interface PopulatedEnrollment {
  _id: Types.ObjectId;
  status: EnrollmentStatus;
  finalGrade?: number;
  student: Named;
  subject: Named;
  group: { _id: Types.ObjectId; number: number };
  period: { _id: Types.ObjectId; code: string; status: string; startDate: Date };
}

interface CurriculumSubject {
  _id: Types.ObjectId;
  code: string;
  name: string;
  credits: number;
  semester?: number;
  prerequisites: { _id: Types.ObjectId; code: string; name: string }[];
}

@Injectable()
export class AcademicService {
  constructor(
    @InjectModel(Enrollment.name) private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
    @InjectModel(Evaluation.name) private readonly evaluationModel: Model<EvaluationDocument>,
    @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    private readonly groupsService: GroupsService,
    private readonly gradesService: GradesService,
    private readonly studentsService: StudentsService,
    private readonly teachersService: TeachersService,
    private readonly periodsService: PeriodsService,
  ) {}

  /* ---------------- nomina y planilla de notas de un grupo ---------------- */

  async roster(groupId: string, status: EnrollmentStatus | undefined, user: AuthUser) {
    await this.groupsService.assertCanManage(groupId, user);
    const group = await this.loadGroup(groupId);
    const enrollments = await this.groupEnrollments(groupId, status);

    return {
      group: this.groupHeader(group),
      total: enrollments.length,
      students: enrollments.map((e) => ({
        enrollment: e._id,
        status: e.status,
        finalGrade: e.finalGrade ?? null,
        student: this.studentInfo(e.student),
      })),
    };
  }

  async gradeSheet(groupId: string, user: AuthUser) {
    await this.groupsService.assertCanManage(groupId, user);
    const group = await this.loadGroup(groupId);
    const evaluations = await this.evaluationModel.find({ group: groupId }).sort({ createdAt: 1, _id: 1 }).lean();
    const enrollments = await this.groupEnrollments(groupId);

    const grades = await this.gradeModel.find({ enrollment: { $in: enrollments.map((e) => e._id) } }).lean();
    const byEnrollment = new Map<string, Map<string, number>>();
    for (const g of grades) {
      const key = String(g.enrollment);
      if (!byEnrollment.has(key)) byEnrollment.set(key, new Map());
      byEnrollment.get(key)!.set(String(g.evaluation), g.value);
    }

    const totalWeight = evaluations.reduce((sum, e) => sum + e.weight, 0);
    const planComplete = Math.round(totalWeight * 100) === 10000;

    const rows = enrollments.map((e) => {
      const own = byEnrollment.get(String(e._id)) ?? new Map<string, number>();
      let accumulated = 0;
      let evaluatedWeight = 0;
      const values: Record<string, number | null> = {};
      for (const ev of evaluations) {
        const value = own.get(String(ev._id));
        values[String(ev._id)] = value ?? null;
        if (value !== undefined) {
          accumulated += value * (ev.weight / 100);
          evaluatedWeight += ev.weight;
        }
      }
      const pending = evaluations.filter((e) => !own.has(String(e._id))).length;
      return {
        enrollment: e._id,
        status: e.status,
        student: this.studentInfo(e.student),
        grades: values,
        evaluatedWeight,
        // Puntos que ya lleva sobre 5.0, y su promedio sobre lo evaluado hasta ahora
        accumulated: round2(accumulated),
        average: evaluatedWeight > 0 ? round2(accumulated / (evaluatedWeight / 100)) : null,
        pendingEvaluations: pending,
        finalGrade: e.finalGrade ?? null,
        readyToFinalize: e.status === EnrollmentStatus.Active && planComplete && pending === 0,
      };
    });

    return {
      group: this.groupHeader(group),
      evaluations: evaluations.map((e) => ({ id: e._id, name: e.name, weight: e.weight })),
      summary: {
        totalWeight,
        planComplete,
        students: rows.length,
        readyToFinalize: rows.filter((r) => r.readyToFinalize).length,
      },
      rows,
    };
  }

  // Finaliza todas las matriculas activas del grupo que ya tienen todas sus notas; informa las que no pudo
  async finalizeGroup(groupId: string, user: AuthUser) {
    await this.groupsService.assertCanManage(groupId, user);
    const group = await this.loadGroup(groupId);
    const active = await this.groupEnrollments(groupId, EnrollmentStatus.Active);
    if (active.length === 0) throw new BadRequestException('El grupo no tiene matriculas activas por finalizar');

    const evaluations = await this.evaluationModel.find({ group: groupId }).select('weight').lean();
    const totalWeight = evaluations.reduce((sum, e) => sum + e.weight, 0);
    if (Math.round(totalWeight * 100) !== 10000) {
      throw new BadRequestException(`Los porcentajes del grupo no suman 100 (suman ${totalWeight})`);
    }

    const finalized: { enrollment: Types.ObjectId; student: string; finalGrade: number; status: EnrollmentStatus }[] = [];
    const skipped: { enrollment: Types.ObjectId; student: string; reason: string }[] = [];
    for (const e of active) {
      const label = e.student.code ?? String(e.student._id);
      try {
        const result = await this.gradesService.finalize(String(e._id), user);
        finalized.push({ enrollment: e._id, student: label, finalGrade: result.finalGrade, status: result.status });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        skipped.push({ enrollment: e._id, student: label, reason: this.messageOf(error) });
      }
    }

    return {
      group: this.groupHeader(group),
      finalized: finalized.length,
      passed: finalized.filter((f) => f.status === EnrollmentStatus.Passed).length,
      failed: finalized.filter((f) => f.status === EnrollmentStatus.Failed).length,
      skipped: skipped.length,
      details: { finalized, skipped },
    };
  }

  /* ---------------- horarios ---------------- */

  async studentSchedule(studentId: string | null, userId: string | null, periodId?: string) {
    const student = studentId
      ? await this.studentsService.findOne(studentId)
      : await this.studentsService.findByUserId(userId as string);
    const period = await this.resolvePeriod(periodId);

    const enrollments = await this.enrollmentModel
      .find({ student: student.id, period: period.id, status: { $ne: EnrollmentStatus.Cancelled } })
      .select('group status')
      .lean();
    const groups = await this.loadGroups({ _id: { $in: enrollments.map((e) => e.group) } });

    const enrollmentByGroup = new Map(enrollments.map((e) => [String(e.group), e.status]));
    const slots = groups.flatMap((g) =>
      g.schedule.map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        classroom: s.classroom?.code ?? null,
        building: s.classroom?.building ?? null,
        subject: { code: g.subject.code, name: g.subject.name },
        group: g.number,
        teacher: g.teacher?.user?.name ?? null,
        enrollmentStatus: enrollmentByGroup.get(String(g._id)),
      })),
    );

    const owner = student.toObject() as unknown as { _id: Types.ObjectId; code: string; user: { name: string } };
    return {
      student: { id: owner._id, code: owner.code, name: owner.user?.name },
      period: { id: period.id, code: period.code, status: period.status },
      subjects: groups.length,
      credits: groups.reduce((sum, g) => sum + (g.subject.credits ?? 0), 0),
      ...this.arrange(slots),
    };
  }

  async teacherSchedule(teacherId: string | null, userId: string | null, periodId?: string) {
    const teacher = teacherId
      ? await this.teachersService.findOne(teacherId)
      : await this.teachersService.findByUserId(userId as string);
    const period = await this.resolvePeriod(periodId);

    const groups = await this.loadGroups({ teacher: teacher.id, period: period.id, active: true });
    const slots = groups.flatMap((g) =>
      g.schedule.map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        classroom: s.classroom?.code ?? null,
        building: s.classroom?.building ?? null,
        subject: { code: g.subject.code, name: g.subject.name },
        group: g.number,
        groupId: g._id,
        enrolled: g.enrolled,
      })),
    );

    const owner = teacher.toObject() as unknown as { _id: Types.ObjectId; code: string; user: { name: string } };
    return {
      teacher: { id: owner._id, code: owner.code, name: owner.user?.name },
      period: { id: period.id, code: period.code, status: period.status },
      groups: groups.length,
      students: groups.reduce((sum, g) => sum + g.enrolled, 0),
      ...this.arrange(slots),
    };
  }

  /* ---------------- historial academico ---------------- */

  async history(studentId: string | null, userId: string | null) {
    const student = studentId
      ? await this.studentsService.findOne(studentId)
      : await this.studentsService.findByUserId(userId as string);
    const owner = student.toObject() as unknown as {
      _id: Types.ObjectId;
      code: string;
      user: { name: string; email: string };
      program: { _id: Types.ObjectId; code: string; name: string };
    };
    if (!owner.program) throw new NotFoundException('Programa del estudiante no encontrado');
    const program = await this.programModel.findById(owner.program._id).lean();
    if (!program) throw new NotFoundException('Programa del estudiante no encontrado');

    const enrollments = (await this.enrollmentModel
      .find({ student: owner._id, status: { $ne: EnrollmentStatus.Cancelled } })
      .populate('subject', 'code name credits')
      .populate('group', 'number')
      .populate('period', 'code status startDate')
      .lean()) as unknown as PopulatedEnrollment[];

    const closed = enrollments.filter((e) => e.status === EnrollmentStatus.Passed || e.status === EnrollmentStatus.Failed);
    const passedSubjects = new Map<string, number>(); // materia -> creditos (cada materia aprobada cuenta una vez)
    for (const e of enrollments) {
      if (e.status === EnrollmentStatus.Passed) passedSubjects.set(String(e.subject._id), e.subject.credits ?? 0);
    }
    const creditsApproved = [...passedSubjects.values()].reduce((sum, c) => sum + c, 0);

    const periods = new Map<string, { period: PopulatedEnrollment['period']; items: PopulatedEnrollment[] }>();
    for (const e of enrollments) {
      const key = String(e.period._id);
      if (!periods.has(key)) periods.set(key, { period: e.period, items: [] });
      periods.get(key)!.items.push(e);
    }

    const totalCredits = program?.totalCredits ?? 0;
    return {
      student: { id: owner._id, code: owner.code, name: owner.user?.name, email: owner.user?.email },
      program: { id: owner.program._id, code: owner.program.code, name: owner.program.name, totalCredits },
      summary: {
        creditsApproved,
        creditsRemaining: Math.max(totalCredits - creditsApproved, 0),
        progressPercent: totalCredits > 0 ? Math.round((creditsApproved / totalCredits) * 1000) / 10 : 0,
        gpa: this.gpa(closed),
        subjectsPassed: passedSubjects.size,
        subjectsFailed: closed.filter((e) => e.status === EnrollmentStatus.Failed).length,
        inProgress: enrollments.filter((e) => e.status === EnrollmentStatus.Active).length,
      },
      periods: [...periods.values()]
        .sort((a, b) => +new Date(b.period.startDate) - +new Date(a.period.startDate))
        .map(({ period, items }) => ({
          period: { id: period._id, code: period.code, status: period.status },
          credits: items.reduce((sum, e) => sum + (e.subject.credits ?? 0), 0),
          gpa: this.gpa(items.filter((e) => e.finalGrade !== undefined && e.status !== EnrollmentStatus.Active)),
          courses: items
            .sort((a, b) => String(a.subject.code).localeCompare(String(b.subject.code)))
            .map((e) => ({
              enrollment: e._id,
              subject: { id: e.subject._id, code: e.subject.code, name: e.subject.name, credits: e.subject.credits },
              group: e.group?.number,
              status: e.status,
              finalGrade: e.finalGrade ?? null,
            })),
        })),
    };
  }

  /* ---------------- malla curricular y progreso ---------------- */

  // Materias activas del programa agrupadas por semestre, con sus prerrequisitos
  async curriculum(programId: string) {
    const program = await this.programModel.findById(programId).lean();
    if (!program) throw new NotFoundException('Programa no encontrado');
    const subjects = await this.loadCurriculumSubjects(programId);

    const semesters = new Map<number | null, CurriculumSubject[]>();
    for (const s of subjects) {
      const key = s.semester ?? null;
      if (!semesters.has(key)) semesters.set(key, []);
      semesters.get(key)!.push(s);
    }
    return {
      program: { id: program._id, code: program.code, name: program.name, totalCredits: program.totalCredits },
      subjects: subjects.length,
      semesters: [...semesters.entries()]
        .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
        .map(([semester, list]) => ({
          semester,
          credits: list.reduce((sum, s) => sum + s.credits, 0),
          subjects: list.map((s) => ({
            id: s._id,
            code: s.code,
            name: s.name,
            credits: s.credits,
            prerequisites: s.prerequisites.map((p) => ({ id: p._id, code: p.code, name: p.name })),
          })),
        })),
    };
  }

  // La malla del programa del estudiante marcando que ya aprobo, que cursa y que puede matricular
  async progress(studentId: string | null, userId: string | null) {
    const student = studentId
      ? await this.studentsService.findOne(studentId)
      : await this.studentsService.findByUserId(userId as string);
    const owner = student.toObject() as unknown as {
      _id: Types.ObjectId;
      code: string;
      user: { name: string };
      program: { _id: Types.ObjectId; code: string; name: string };
    };
    if (!owner.program) throw new NotFoundException('Programa del estudiante no encontrado');
    const subjects = await this.loadCurriculumSubjects(String(owner.program._id));
    const enrollments = await this.enrollmentModel
      .find({ student: owner._id, status: { $ne: EnrollmentStatus.Cancelled } })
      .select('subject status finalGrade')
      .lean();

    const passed = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Passed).map((e) => String(e.subject)));
    const active = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Active).map((e) => String(e.subject)));
    const failed = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Failed).map((e) => String(e.subject)));

    const rows = subjects.map((s) => {
      const id = String(s._id);
      const status = passed.has(id) ? 'aprobada' : active.has(id) ? 'cursando' : failed.has(id) ? 'reprobada' : 'pendiente';
      const missing = s.prerequisites.filter((p) => !passed.has(String(p._id)));
      return {
        id: s._id,
        code: s.code,
        name: s.name,
        credits: s.credits,
        semester: s.semester ?? null,
        status,
        missingPrerequisites: missing.map((p) => p.code),
        canEnroll: (status === 'pendiente' || status === 'reprobada') && missing.length === 0,
      };
    });
    const count = (st: string) => rows.filter((r) => r.status === st).length;
    const creditsOf = (st: string) => rows.filter((r) => r.status === st).reduce((sum, r) => sum + r.credits, 0);

    return {
      student: { id: owner._id, code: owner.code, name: owner.user?.name },
      program: { id: owner.program._id, code: owner.program.code, name: owner.program.name },
      summary: {
        subjects: rows.length,
        passed: count('aprobada'),
        inProgress: count('cursando'),
        failed: count('reprobada'),
        pending: count('pendiente'),
        creditsApproved: creditsOf('aprobada'),
        creditsTotal: rows.reduce((sum, r) => sum + r.credits, 0),
      },
      subjects: rows,
    };
  }

  // Grupos del periodo abierto que el estudiante SI puede matricular: con cupo, prerrequisitos cumplidos,
  // materia no aprobada ni cursada en el periodo. Por defecto solo de su programa (all=true para todos)
  async availableGroups(userId: string, all: boolean) {
    const student = await this.studentsService.findByUserId(userId);
    const owner = student.toObject() as unknown as { _id: Types.ObjectId; program: { _id: Types.ObjectId } };
    if (!owner.program) throw new NotFoundException('Programa del estudiante no encontrado');
    const period = await this.periodsService.findCurrent();

    const enrollments = await this.enrollmentModel
      .find({ student: owner._id, status: { $ne: EnrollmentStatus.Cancelled } })
      .select('subject period status')
      .lean();
    const passed = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Passed).map((e) => String(e.subject)));
    const takenNow = new Set(enrollments.filter((e) => String(e.period) === period.id).map((e) => String(e.subject)));

    const groups = (await this.groupModel
      .find({ period: period._id, active: true, $expr: { $lt: ['$enrolled', '$capacity'] } })
      .populate({ path: 'subject', select: 'code name credits program prerequisites active' })
      .populate({ path: 'teacher', select: 'code user', populate: { path: 'user', select: 'name' } })
      .populate('schedule.classroom', 'code building')
      .lean()) as unknown as (Omit<PopulatedGroup, 'subject'> & {
      subject: Named & { program: Types.ObjectId; prerequisites: Types.ObjectId[]; active: boolean };
    })[];

    const rows = groups
      .filter((g) => {
        const id = String(g.subject._id);
        if (!g.subject.active || passed.has(id) || takenNow.has(id)) return false;
        if (!all && String(g.subject.program) !== String(owner.program._id)) return false;
        return g.subject.prerequisites.every((p) => passed.has(String(p)));
      })
      .map((g) => ({
        group: g._id,
        number: g.number,
        subject: { id: g.subject._id, code: g.subject.code, name: g.subject.name, credits: g.subject.credits },
        teacher: g.teacher?.user?.name ?? null,
        capacity: g.capacity,
        availableSeats: Math.max(g.capacity - g.enrolled, 0),
        schedule: g.schedule.map((s) => ({
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          classroom: s.classroom?.code ?? null,
        })),
      }))
      .sort((a, b) => String(a.subject.code).localeCompare(String(b.subject.code)) || a.number - b.number);

    return { period: { id: period.id, code: period.code }, total: rows.length, groups: rows };
  }

  /* ---------------- utilidades ---------------- */

  private async loadCurriculumSubjects(programId: string): Promise<CurriculumSubject[]> {
    return (await this.subjectModel
      .find({ program: programId, active: true })
      .populate('prerequisites', 'code name')
      .sort({ semester: 1, code: 1 })
      .lean()) as unknown as CurriculumSubject[];
  }

  // Promedio ponderado por creditos de las matriculas ya cerradas (null si no hay ninguna)
  private gpa(items: PopulatedEnrollment[]): number | null {
    const graded = items.filter((e) => e.finalGrade !== undefined && e.finalGrade !== null);
    const credits = graded.reduce((sum, e) => sum + (e.subject.credits ?? 0), 0);
    if (credits === 0) return null;
    return round2(graded.reduce((sum, e) => sum + (e.finalGrade as number) * (e.subject.credits ?? 0), 0) / credits);
  }

  private async resolvePeriod(periodId?: string) {
    return periodId ? this.periodsService.findOne(periodId) : this.periodsService.findCurrent();
  }

  private async loadGroup(id: string): Promise<PopulatedGroup> {
    const [group] = await this.loadGroups({ _id: id });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  private async loadGroups(filter: FilterQuery<GroupDocument>): Promise<PopulatedGroup[]> {
    return (await this.groupModel
      .find(filter)
      .populate('subject', 'code name credits')
      .populate('period', 'code status')
      .populate({ path: 'teacher', select: 'code user', populate: { path: 'user', select: 'name' } })
      .populate('schedule.classroom', 'code building')
      .lean()) as unknown as PopulatedGroup[];
  }

  private groupEnrollments(groupId: string, status?: EnrollmentStatus): Promise<PopulatedEnrollment[]> {
    const filter: FilterQuery<EnrollmentDocument> = { group: groupId };
    filter.status = status ?? { $ne: EnrollmentStatus.Cancelled };
    return this.enrollmentModel
      .find(filter)
      .populate({ path: 'student', select: 'code user', populate: { path: 'user', select: 'name email' } })
      .lean()
      .then((list) =>
        (list as unknown as PopulatedEnrollment[]).sort((a, b) => String(a.student.code).localeCompare(String(b.student.code))),
      );
  }

  private groupHeader(group: PopulatedGroup) {
    return {
      id: group._id,
      number: group.number,
      subject: { code: group.subject.code, name: group.subject.name, credits: group.subject.credits },
      period: { code: group.period.code, status: group.period.status },
      teacher: group.teacher?.user?.name ?? null,
      capacity: group.capacity,
      enrolled: group.enrolled,
      availableSeats: Math.max(group.capacity - group.enrolled, 0),
    };
  }

  private studentInfo(student: Named) {
    return { id: student._id, code: student.code, name: student.user?.name, email: student.user?.email };
  }

  // Ordena las franjas por dia y hora y las agrupa por dia (lista plana + mapa por dia)
  private arrange<T extends { day: string; startTime: string }>(slots: T[]) {
    const sorted = [...slots].sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime),
    );
    const byDay: Record<string, T[]> = {};
    for (const s of sorted) (byDay[s.day] ??= []).push(s);
    return { slots: sorted, byDay };
  }

  private messageOf(error: HttpException): string {
    const res = error.getResponse();
    const message = typeof res === 'string' ? res : (res as { message?: string | string[] }).message;
    return Array.isArray(message) ? message.join('; ') : (message ?? error.message);
  }
}
