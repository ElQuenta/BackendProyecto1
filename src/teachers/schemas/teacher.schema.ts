import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type TeacherDocument = HydratedDocument<Teacher>;

@Schema({ timestamps: true })
export class Teacher {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, unique: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  code!: string;

  // Facultad a la que pertenece el docente (ref por nombre para evitar importacion circular con Faculty)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Faculty', required: true, index: true })
  faculty!: Types.ObjectId;

  @Prop({ default: true })
  active!: boolean;
}

export const TeacherSchema = SchemaFactory.createForClass(Teacher);
