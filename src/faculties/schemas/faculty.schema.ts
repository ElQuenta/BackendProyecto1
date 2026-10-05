import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Teacher } from '../../teachers/schemas/teacher.schema';

export type FacultyDocument = HydratedDocument<Faculty>;

@Schema({ timestamps: true })
export class Faculty {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  // Sede donde funciona la facultad
  @Prop({ required: true, trim: true, index: true })
  campus!: string;

  // Docente que ejerce como decano (puede estar vacio mientras se nombra)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Teacher.name })
  dean?: Types.ObjectId;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ default: true })
  active!: boolean;
}

export const FacultySchema = SchemaFactory.createForClass(Faculty);
