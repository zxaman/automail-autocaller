import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface WorkspaceAttributes {
  name: string;
  ownerId: Types.ObjectId;
  plan: 'free' | 'pro';
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceDocument = HydratedDocument<WorkspaceAttributes>;

/**
 * Every user gets a private workspace on first login. All business resources are
 * scoped to a workspace so multi-user teams can be added later without a data
 * migration, while today each workspace has exactly one owner.
 */
const workspaceSchema = new Schema<WorkspaceAttributes>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  },
  { timestamps: true, versionKey: false },
);

export const WorkspaceModel: Model<WorkspaceAttributes> = model<WorkspaceAttributes>(
  'Workspace',
  workspaceSchema,
);
