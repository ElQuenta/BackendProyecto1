import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FacultiesModule } from '../faculties/faculties.module';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { Program, ProgramSchema } from './schemas/program.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Program.name, schema: ProgramSchema }]), FacultiesModule],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
