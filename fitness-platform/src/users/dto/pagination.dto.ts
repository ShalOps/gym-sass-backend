import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  location: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  goal: z.enum(['WEIGHTLOSS', 'YOGA', 'BODYBUILDING']).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'GYMOWNER', 'TRAINER']).optional(),
  birthDateFrom: z.string().optional(), // ISO date string
  birthDateTo: z.string().optional(),
});

export type PaginationDto = z.infer<typeof PaginationSchema>;
