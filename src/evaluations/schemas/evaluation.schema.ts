import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Group } from '../../groups/schemas/group.schema';

export type EvaluationDocument = HydratedDocument<Evaluation>;

// Una evaluacion del plan de un grupo (ej. "Parcial 1", 25 %). Los porcentajes del grupo deben sumar 100
@Schema({ timestamps: true })
export class Evaluation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Group.name, required: true, index: true })
  group!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, min: 1, max: 100 })
  weight!: number;
}

export const EvaluationSchema = SchemaFactory.createForClass(Evaluation);
EvaluationSchema.index({ group: 1, name: 1 }, { unique: true });
