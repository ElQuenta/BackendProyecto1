import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Paginated, PaginationQueryDto, paginate } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  // Crea el primer administrador si no existe ninguno
  async onModuleInit(): Promise<void> {
    if (await this.userModel.exists({ role: Role.Admin })) return;

    const email = this.config.getOrThrow<string>('ADMIN_EMAIL');
    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');
    await this.create({ name: 'Administrador', email, password, role: Role.Admin });
    this.logger.log(`Administrador inicial creado: ${email}`);
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.userModel.create({
      name: dto.name,
      email: dto.email,
      role: dto.role ?? Role.Estudiante,
      passwordHash,
    });
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<User>> {
    const [data, total] = await Promise.all([
      this.userModel.find().sort({ createdAt: -1 }).skip(query.skip).limit(query.limit).exec(),
      this.userModel.countDocuments().exec(),
    ]);
    return paginate(data, total, query);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
  }
}
