import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Paginated, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreatePeriodDto, UpdatePeriodDto } from './dto/period.dto';
import { PeriodsService } from './periods.service';
import { Period } from './schemas/period.schema';

@ApiTags('periods')
@ApiBearerAuth()
@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreatePeriodDto): Promise<Period> {
    return this.periodsService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto): Promise<Paginated<Period>> {
    return this.periodsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<Period> {
    return this.periodsService.findOne(id);
  }

  @Roles(Role.Admin)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdatePeriodDto,
  ): Promise<Period> {
    return this.periodsService.update(id, dto);
  }
}
