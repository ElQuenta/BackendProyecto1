import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Paginated, paginate } from '../common/dto/pagination-query.dto';
import { textPattern } from '../common/dto/query-helpers';
import { FacultiesService } from '../faculties/faculties.service';
import { CreateProgramDto, ProgramsQueryDto, UpdateProgramDto } from './dto/program.dto';
import { Program, ProgramDocument } from './schemas/program.schema';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectModel(Program.name) private readonly model: Model<ProgramDocument>,
    private readonly facultiesService: FacultiesService,
  ) {}

  async create(dto: CreateProgramDto): Promise<ProgramDocument> {
    if (dto.faculty) await this.facultiesService.findOne(dto.faculty);
    return this.model.create(dto);
  }

  async findAll(query: ProgramsQueryDto): Promise<Paginated<Program>> {
    const filter: FilterQuery<ProgramDocument> = {};
    if (query.faculty) filter.faculty = query.faculty;
    if (query.active !== undefined) filter.active = query.active;
    if (query.q) {
      const pattern = textPattern(query.q);
      filter.$or = [{ code: pattern }, { name: pattern }];
    }

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ code: 1 }).skip(query.skip).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<ProgramDocument> {
    const program = await this.model.findById(id).exec();
    if (!program) throw new NotFoundException('Programa no encontrado');
    return program;
  }

  async update(id: string, dto: UpdateProgramDto): Promise<ProgramDocument> {
    if (dto.faculty) await this.facultiesService.findOne(dto.faculty);
    const program = await this.model
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!program) throw new NotFoundException('Programa no encontrado');
    return program;
  }
}
