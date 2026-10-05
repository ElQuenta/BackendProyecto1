import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeachersModule } from '../teachers/teachers.module';
import { FacultiesController } from './faculties.controller';
import { FacultiesService } from './faculties.service';
import { Faculty, FacultySchema } from './schemas/faculty.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Faculty.name, schema: FacultySchema }]), TeachersModule],
  controllers: [FacultiesController],
  providers: [FacultiesService],
  exports: [FacultiesService],
})
export class FacultiesModule {}
