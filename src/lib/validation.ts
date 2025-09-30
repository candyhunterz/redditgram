/**
 * Input validation utilities
 * Provides reusable validation schemas and functions
 */

import { z } from 'zod';

// Reddit-specific validations
export const subredditSchema = z
  .string()
  .min(1, 'Subreddit name is required')
  .max(21, 'Subreddit name is too long')
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'Subreddit name contains invalid characters')
  .transform((val) => val.toLowerCase());

export const sortTypeSchema = z.enum(['hot', 'top'], {
  errorMap: () => ({ message: 'Sort type must be either "hot" or "top"' }),
});

export const timeFrameSchema = z.enum(['day', 'week', 'month', 'year', 'all'], {
  errorMap: () => ({ message: 'Invalid time frame' }),
});

export const limitSchema = z
  .string()
  .transform((val) => parseInt(val, 10))
  .pipe(
    z
      .number()
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
  );

// API request validation schemas
export const redditApiQuerySchema = z.object({
  subreddit: subredditSchema,
  sortType: sortTypeSchema,
  timeFrame: timeFrameSchema.optional(),
  after: z.string().optional(),
  limit: limitSchema.optional().default('20'),
});

export type RedditApiQuery = z.infer<typeof redditApiQuerySchema>;

/**
 * Validate multiple subreddit names from comma-separated string
 */
export function validateSubreddits(input: string): string[] {
  const subreddits = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (subreddits.length === 0) {
    throw new Error('At least one subreddit is required');
  }

  if (subreddits.length > 10) {
    throw new Error('Maximum 10 subreddits allowed');
  }

  // Validate each subreddit
  const validatedSubreddits: string[] = [];
  for (const sub of subreddits) {
    try {
      validatedSubreddits.push(subredditSchema.parse(sub));
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid subreddit "${sub}": ${error.errors[0].message}`);
      }
      throw error;
    }
  }

  return validatedSubreddits;
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .slice(0, 1000); // Limit length
}

/**
 * Validate URL is from allowed domains
 */
export function isAllowedImageDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const allowedDomains = [
      'i.redd.it',
      'preview.redd.it',
      'external-preview.redd.it',
      'i.imgur.com',
      'imgur.com',
      'v.redd.it',
    ];
    
    return allowedDomains.some(domain => 
      parsedUrl.hostname === domain || 
      parsedUrl.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Error response helper for validation failures
 */
export function createValidationErrorResponse(error: z.ZodError) {
  const errorMessages = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return {
    error: 'Validation failed',
    details: errorMessages,
  };
}