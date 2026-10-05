import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Program } from '../../programs/schemas/program.schema';
import { User } from '../../users/schemas/user.schema';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true })
export class Student {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, unique: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  code!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Program.name, required: true, index: true })
  program!: Types.ObjectId;

  @Prop({ default: true })
  active!: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
