import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassroomsModule } from '../classrooms/classrooms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeriodsModule } from '../periods/periods.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { TeachersModule } from '../teachers/teachers.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { Group, GroupSchema } from './schemas/group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]),
    SubjectsModule,
    TeachersModule,
    PeriodsModule,
    ClassroomsModule,
    NotificationsModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
