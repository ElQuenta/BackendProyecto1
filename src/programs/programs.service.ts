import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paginated, PaginationQueryDto, paginate } from '../common/dto/pagination-query.dto';
import { CreateProgramDto, UpdateProgramDto } from './dto/program.dto';
import { Program, ProgramDocument } from './schemas/program.schema';

@Injectable()
export class ProgramsService {
  constructor(@InjectModel(Program.name) private readonly model: Model<ProgramDocument>) {}

  create(dto: CreateProgramDto): Promise<ProgramDocument> {
    return this.model.create(dto);
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<Program>> {
    const [data, total] = await Promise.all([
      this.model.find().sort({ code: 1 }).skip(query.skip).limit(query.limit).exec(),
      this.model.countDocuments().exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<ProgramDocument> {
    const program = await this.model.findById(id).exec();
    if (!program) throw new NotFoundException('Programa no encontrado');
    return program;
  }

  async update(id: string, dto: UpdateProgramDto): Promise<ProgramDocument> {
    const program = await this.model
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!program) throw new NotFoundException('Programa no encontrado');
    return program;
  }
}
