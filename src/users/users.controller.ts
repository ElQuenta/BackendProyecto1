import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Paginated, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto): Promise<Paginated<User>> {
    return this.usersService.findAll(query);
  }

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<{ id: string; name: string; email: string; role: Role }> {
    const user = await this.usersService.create(dto);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
