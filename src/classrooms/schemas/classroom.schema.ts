import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClassroomDocument = HydratedDocument<Classroom>;

export enum RoomType {
  Classroom = 'aula',
  Lab = 'laboratorio',
  Auditorium = 'auditorio',
  ComputerRoom = 'sala de computo',
}

// El codigo coincide con el salon que usan los horarios de los grupos (ej. "B-203")
@Schema({ timestamps: true })
export class Classroom {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, uppercase: true, trim: true, index: true })
  building!: string;

  @Prop({ required: true, min: 1, max: 30 })
  floor!: number;

  @Prop({ required: true, min: 5, max: 500 })
  capacity!: number;

  @Prop({ required: true, enum: RoomType, default: RoomType.Classroom })
  type!: RoomType;

  @Prop({ default: true })
  hasProjector!: boolean;

  @Prop({ default: true })
  active!: boolean;
}

export const ClassroomSchema = SchemaFactory.createForClass(Classroom);
