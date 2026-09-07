import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const USER_ROLES = ['owner', 'admin', 'manager', 'agent'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserPreferences {
  timezone: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
}

export interface UserAttributes {
  googleId: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: UserRole;
  workspaceId: Types.ObjectId;
  preferences: UserPreferences;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const preferencesSchema = new Schema<UserPreferences>(
  {
    timezone: { type: String, default: 'Asia/Kolkata', trim: true },
    locale: { type: String, default: 'en-IN', trim: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
  },
  { _id: false },
);

const userSchema = new Schema<UserAttributes>(
  {
    googleId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    profileImageUrl: { type: String, default: null },
    role: { type: String, enum: USER_ROLES, default: 'owner', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    preferences: { type: preferencesSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Google subject and email are unique account identifiers.
userSchema.index({ googleId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
// Supports future team listings scoped to a workspace.
userSchema.index({ workspaceId: 1, role: 1 });

export const UserModel: Model<UserAttributes> = model<UserAttributes>('User', userSchema);
