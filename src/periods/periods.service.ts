import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paginated, PaginationQueryDto, paginate } from '../common/dto/pagination-query.dto';
import { CreatePeriodDto, UpdatePeriodDto } from './dto/period.dto';
import { Period, PeriodDocument, PeriodStatus } from './schemas/period.schema';

@Injectable()
export class PeriodsService {
  constructor(@InjectModel(Period.name) private readonly model: Model<PeriodDocument>) {}

  create(dto: CreatePeriodDto): Promise<PeriodDocument> {
    this.assertDates(new Date(dto.startDate), new Date(dto.endDate));
    return this.model.create(dto);
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<Period>> {
    const [data, total] = await Promise.all([
      this.model.find().sort({ startDate: -1 }).skip(query.skip).limit(query.limit).exec(),
      this.model.countDocuments().exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<PeriodDocument> {
    const period = await this.model.findById(id).exec();
    if (!period) throw new NotFoundException('Periodo no encontrado');
    return period;
  }

  async update(id: string, dto: UpdatePeriodDto): Promise<PeriodDocument> {
    const period = await this.findOne(id);

    const start = dto.startDate ? new Date(dto.startDate) : period.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : period.endDate;
    this.assertDates(start, end);

    // Solo puede haber un periodo abierto a la vez
    if (dto.status === PeriodStatus.Open && period.status !== PeriodStatus.Open) {
      const open = await this.model.exists({ status: PeriodStatus.Open, _id: { $ne: id } });
      if (open) throw new ConflictException('Ya existe otro periodo abierto');
    }

    period.set({ ...dto, startDate: start, endDate: end });
    return period.save();
  }

  private assertDates(start: Date, end: Date): void {
    if (end <= start) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la de inicio');
    }
  }
}
