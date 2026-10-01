import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paginated, PaginationQueryDto, paginate } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';
import { Teacher, TeacherDocument } from './schemas/teacher.schema';

@Injectable()
export class TeachersService {
  constructor(
    @InjectModel(Teacher.name) private readonly model: Model<TeacherDocument>,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateTeacherDto): Promise<TeacherDocument> {
    const user = await this.usersService.findById(dto.user);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== Role.Docente) {
      throw new BadRequestException('El usuario no tiene rol docente');
    }
    return this.model.create(dto);
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<Teacher>> {
    const [data, total] = await Promise.all([
      this.model
        .find()
        .populate('user', 'name email')
        .sort({ code: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments().exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<TeacherDocument> {
    const teacher = await this.model.findById(id).populate('user', 'name email').exec();
    if (!teacher) throw new NotFoundException('Docente no encontrado');
    return teacher;
  }

  async findByUserId(userId: string): Promise<TeacherDocument> {
    const teacher = await this.model.findOne({ user: userId }).populate('user', 'name email').exec();
    if (!teacher) throw new NotFoundException('El usuario no tiene perfil de docente');
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<TeacherDocument> {
    const teacher = await this.model
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!teacher) throw new NotFoundException('Docente no encontrado');
    return teacher;
  }
}
