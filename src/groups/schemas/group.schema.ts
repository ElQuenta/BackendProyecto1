import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Classroom } from '../../classrooms/schemas/classroom.schema';
import { Period } from '../../periods/schemas/period.schema';
import { Subject } from '../../subjects/schemas/subject.schema';
import { Teacher } from '../../teachers/schemas/teacher.schema';

export type GroupDocument = HydratedDocument<Group>;

export enum Day {
  Lunes = 'lunes',
  Martes = 'martes',
  Miercoles = 'miercoles',
  Jueves = 'jueves',
  Viernes = 'viernes',
  Sabado = 'sabado',
}

@Schema({ _id: false })
export class ScheduleSlot {
  @Prop({ required: true, enum: Day })
  day!: Day;

  // Formato HH:mm de 24 horas (comparable como texto)
  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  startTime!: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  endTime!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Classroom.name, required: true })
  classroom!: Types.ObjectId;
}
export const ScheduleSlotSchema = SchemaFactory.createForClass(ScheduleSlot);

@Schema({ timestamps: true })
export class Group {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Subject.name, required: true })
  subject!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Teacher.name, required: true, index: true })
  teacher!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Period.name, required: true, index: true })
  period!: Types.ObjectId;

  // Numero de grupo dentro de (materia, periodo): 1, 2, 3...
  @Prop({ required: true, min: 1 })
  number!: number;

  @Prop({ required: true, min: 1, max: 100 })
  capacity!: number;

  // Estudiantes matriculados. Cupos disponibles = capacity - enrolled
  @Prop({ default: 0, min: 0 })
  enrolled!: number;

  @Prop({ type: [ScheduleSlotSchema], default: [] })
  schedule!: ScheduleSlot[];

  @Prop({ default: true })
  active!: boolean;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
GroupSchema.index({ subject: 1, period: 1, number: 1 }, { unique: true });

// Campo calculado (no se guarda en Mongo): aparece en las respuestas JSON como 'availableSeats'
GroupSchema.virtual('availableSeats').get(function (this: Group) {
  return Math.max(this.capacity - this.enrolled, 0);
});
GroupSchema.set('toJSON', { virtuals: true });
