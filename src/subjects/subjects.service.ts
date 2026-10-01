import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Paginated, paginate } from '../common/dto/pagination-query.dto';
import { ProgramsService } from '../programs/programs.service';
import { CreateSubjectDto, SubjectsQueryDto, UpdateSubjectDto } from './dto/subject.dto';
import { Subject, SubjectDocument } from './schemas/subject.schema';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private readonly model: Model<SubjectDocument>,
    private readonly programsService: ProgramsService,
  ) {}

  async create(dto: CreateSubjectDto): Promise<SubjectDocument> {
    await this.programsService.findOne(dto.program);
    await this.assertPrerequisitesExist(dto.prerequisites ?? []);
    return this.model.create(dto);
  }

  async findAll(query: SubjectsQueryDto): Promise<Paginated<Subject>> {
    const filter: FilterQuery<SubjectDocument> = query.program ? { program: query.program } : {};
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('prerequisites', 'code name')
        .sort({ semester: 1, code: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<SubjectDocument> {
    const subject = await this.model.findById(id).populate('prerequisites', 'code name').exec();
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectDocument> {
    if (dto.program) await this.programsService.findOne(dto.program);
    if (dto.prerequisites) {
      await this.assertPrerequisitesExist(dto.prerequisites);
      await this.assertNoCycle(id, dto.prerequisites);
    }
    const subject = await this.model
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .populate('prerequisites', 'code name')
      .exec();
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return subject;
  }

  private async assertPrerequisitesExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.model.countDocuments({ _id: { $in: ids } }).exec();
    if (found !== ids.length) {
      throw new BadRequestException('Alguno de los prerrequisitos no existe');
    }
  }

  // Evita ciclos: A requiere B y B requiere A (directa o indirectamente)
  private async assertNoCycle(subjectId: string, prerequisites: string[]): Promise<void> {
    const visited = new Set<string>();
    let frontier = [...prerequisites];

    while (frontier.length > 0) {
      if (frontier.includes(subjectId)) {
        throw new BadRequestException('Los prerrequisitos generan un ciclo');
      }
      frontier.forEach((id) => visited.add(id));

      const parents = await this.model
        .find({ _id: { $in: frontier } }, { prerequisites: 1 })
        .exec();
      frontier = parents
        .flatMap((p) => p.prerequisites.map(String))
        .filter((id) => !visited.has(id));
    }
  }
}
