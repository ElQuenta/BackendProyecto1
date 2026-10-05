import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Classroom, ClassroomSchema } from '../classrooms/schemas/classroom.schema';
import { Enrollment, EnrollmentSchema } from '../enrollments/schemas/enrollment.schema';
import { Evaluation, EvaluationSchema } from '../evaluations/schemas/evaluation.schema';
import { Faculty, FacultySchema } from '../faculties/schemas/faculty.schema';
import { Grade, GradeSchema } from '../grades/schemas/grade.schema';
import { GroupsModule } from '../groups/groups.module';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { Period, PeriodSchema } from '../periods/schemas/period.schema';
import { PeriodsModule } from '../periods/periods.module';
import { Program, ProgramSchema } from '../programs/schemas/program.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DeletionsController } from './deletions.controller';
import { DeletionsService } from './deletions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Evaluation.name, schema: EvaluationSchema },
      { name: Grade.name, schema: GradeSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Faculty.name, schema: FacultySchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Period.name, schema: PeriodSchema },
      { name: User.name, schema: UserSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Teacher.name, schema: TeacherSchema },
    ]),
    GroupsModule,
    PeriodsModule,
  ],
  controllers: [DeletionsController],
  providers: [DeletionsService],
})
export class DeletionsModule {}
