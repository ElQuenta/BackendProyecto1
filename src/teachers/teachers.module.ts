import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Faculty, FacultySchema } from '../faculties/schemas/faculty.schema';
import { UsersModule } from '../users/users.module';
import { Teacher, TeacherSchema } from './schemas/teacher.schema';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Teacher.name, schema: TeacherSchema },
      { name: Faculty.name, schema: FacultySchema },
    ]),
    UsersModule,
  ],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
