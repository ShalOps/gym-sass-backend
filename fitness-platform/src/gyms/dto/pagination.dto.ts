import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  location: z.string().optional(),
  workingHours: z.string().optional(),
  verified: z.coerce.boolean().optional(),
  gymOwnerId: z.coerce.number().int().optional(), // For admin or owner use
});

export type PaginationDto = z.infer<typeof PaginationSchema>;
