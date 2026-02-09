import { z } from 'zod';

/**
 * Input validation schemas using Zod
 * Provides type-safe validation for API request bodies
 */

// Article creation schema
export const articleCreateSchema = z.object({
  topicId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  url: z.string().url().max(2000),
  source: z.string().max(200).optional(),
  summary: z.string().max(5000).optional(),
  imageUrl: z.string().url().max(2000).optional(),
  publishedAt: z.string().datetime().optional(),
});

// Article update schema (all fields optional)
export const articleUpdateSchema = articleCreateSchema.partial();

// Article deletion schema
export const articleDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).optional(),
  url: z.string().max(2000).optional(),
  topicId: z.number().int().positive().optional(),
  source: z.string().max(200).optional(),
}).refine(
  data => data.ids || data.url || data.topicId || data.source,
  { message: 'Must provide at least one filter: ids, url, topicId, or source' }
);

// Topic deletion schema
export const topicDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).optional(),
  articleCount: z.number().int().min(0).optional(),
}).refine(
  data => data.ids || data.articleCount !== undefined,
  { message: 'Must provide either ids array or articleCount' }
);

/**
 * Generic validation helper function
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Success object with validated data or error object with message
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format validation errors
  const errors = result.error.issues.map(i =>
    `${i.path.join('.') || 'root'}: ${i.message}`
  );
  return { success: false, error: errors.join(', ') };
}
