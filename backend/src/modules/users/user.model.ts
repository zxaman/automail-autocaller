import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const USER_ROLES = ['owner', 'admin', 'manager', 'agent'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserPreferences {
  timezone: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
}

export interface UserAttributes {
  username: string;
  name?: string;
  email: string;
  passwordHash: string;
  dateOfBirth: Date;
  phoneNumber: string;
  appCode: string;
  userType: 'root' | 'employee';
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
    username: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    name: { type: String, trim: true, maxlength: 160 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 320 },
    passwordHash: { type: String, required: true, select: false },
    dateOfBirth: { type: Date, required: true },
    phoneNumber: { type: String, required: true, trim: true, maxlength: 20 },
    appCode: { type: String, required: true, trim: true, maxlength: 50 },
    userType: { type: String, enum: ['root', 'employee'], default: 'root' },
    profileImageUrl: { type: String, default: null },
    role: { type: String, enum: USER_ROLES, default: 'owner', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    preferences: { type: preferencesSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Supports future team listings scoped to a workspace.
userSchema.index({ workspaceId: 1, role: 1 });

// Legacy Google-auth data left a unique `googleId` index in some databases.
// Password-based registration does not populate that field, so a regular
// unique index would treat every new user as `googleId = null` and reject the
// second account. Mark it sparse here and drop the stale non-sparse index so
// both auth flows can coexist safely.
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

export const UserModel: Model<UserAttributes> = model<UserAttributes>('User', userSchema);
