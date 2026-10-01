import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paginated, PaginationQueryDto, paginate } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { ProgramsService } from '../programs/programs.service';
import { UsersService } from '../users/users.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { Student, StudentDocument } from './schemas/student.schema';

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name) private readonly model: Model<StudentDocument>,
    private readonly usersService: UsersService,
    private readonly programsService: ProgramsService,
  ) {}

  async create(dto: CreateStudentDto): Promise<StudentDocument> {
    const user = await this.usersService.findById(dto.user);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== Role.Estudiante) {
      throw new BadRequestException('El usuario no tiene rol estudiante');
    }
    await this.programsService.findOne(dto.program);
    return this.model.create(dto);
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<Student>> {
    const [data, total] = await Promise.all([
      this.model
        .find()
        .populate('user', 'name email')
        .populate('program', 'code name')
        .sort({ code: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments().exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<StudentDocument> {
    const student = await this.model
      .findById(id)
      .populate('user', 'name email')
      .populate('program', 'code name')
      .exec();
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    return student;
  }

  // Perfil del estudiante a partir de su usuario autenticado
  async findByUserId(userId: string): Promise<StudentDocument> {
    const student = await this.model
      .findOne({ user: userId })
      .populate('user', 'name email')
      .populate('program', 'code name')
      .exec();
    if (!student) throw new NotFoundException('El usuario no tiene perfil de estudiante');
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<StudentDocument> {
    if (dto.program) await this.programsService.findOne(dto.program);
    const student = await this.model
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    return student;
  }
}
