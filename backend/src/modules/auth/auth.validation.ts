import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(80),
  email: z.string().trim().email('Invalid email address').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  dateOfBirth: z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid date'),
  phoneNumber: z.string().trim().min(6, 'Phone number is too short').max(20),
  appCode: z.string().trim().min(1, 'App code is required').max(50),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').max(320),
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
