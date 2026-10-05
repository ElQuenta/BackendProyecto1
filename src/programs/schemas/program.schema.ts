import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProgramDocument = HydratedDocument<Program>;

@Schema({ timestamps: true })
export class Program {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, min: 1 })
  totalCredits!: number;

  // Facultad a la que pertenece el programa (opcional)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Faculty', index: true })
  faculty?: Types.ObjectId;

  @Prop({ default: true })
  active!: boolean;
}

export const ProgramSchema = SchemaFactory.createForClass(Program);
