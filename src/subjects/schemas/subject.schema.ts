import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Program } from '../../programs/schemas/program.schema';

export type SubjectDocument = HydratedDocument<Subject>;

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, min: 1, max: 10 })
  credits!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Program.name, required: true, index: true })
  program!: Types.ObjectId;

  @Prop({ min: 1, max: 12 })
  semester?: number;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Subject' }], default: [] })
  prerequisites!: Types.ObjectId[];

  @Prop({ default: true })
  active!: boolean;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
