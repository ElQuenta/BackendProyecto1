import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Enrollment, EnrollmentSchema } from '../enrollments/schemas/enrollment.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';
import { Period, PeriodSchema } from './schemas/period.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Period.name, schema: PeriodSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Group.name, schema: GroupSchema },
    ]),
  ],
  controllers: [PeriodsController],
  providers: [PeriodsService],
  exports: [PeriodsService],
})
export class PeriodsModule {}
