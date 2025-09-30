/**
 * Environment variable validation utilities
 * Ensures all required environment variables are present and valid
 */

import { z } from 'zod';

const envSchema = z.object({
  REDDIT_CLIENT_ID: z.string().min(1, 'Reddit Client ID is required'),
  REDDIT_CLIENT_SECRET: z.string().min(1, 'Reddit Client Secret is required'),
  REDDIT_USERNAME: z.string().optional(),
  KV_URL: z.string().url('Invalid KV URL').optional(),
  KV_REST_API_URL: z.string().url('Invalid KV REST API URL').optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validates and returns environment variables
 * Throws descriptive errors for missing or invalid variables
 */
export function getValidatedEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = envSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(
        `Environment validation failed:\n${errorMessages.join('\n')}`
      );
    }
    throw error;
  }
}

/**
 * Checks if all required environment variables are present
 * Returns boolean instead of throwing
 */
export function isEnvValid(): boolean {
  try {
    getValidatedEnv();
    return true;
  } catch {
    return false;
  }
}