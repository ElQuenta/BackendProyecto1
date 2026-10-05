import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentsModule } from '../students/students.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
import { Grade, GradeSchema } from './schemas/grade.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Grade.name, schema: GradeSchema }]),
    EnrollmentsModule,
    EvaluationsModule,
    GroupsModule,
    StudentsModule,
    SubjectsModule,
    NotificationsModule,
  ],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
