/**
 * Rate limiting utilities
 * Implements token bucket algorithm for API rate limiting
 */

import { kv } from '@vercel/kv';
import { apiLogger } from './logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter for development
 * In production, this should be replaced with Redis/KV store
 */
class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    this.cleanup();
    
    const now = Date.now();
    const windowStart = now + config.windowMs;
    const existing = this.store.get(key);

    if (!existing || now > existing.resetTime) {
      // First request or window expired
      this.store.set(key, { count: 1, resetTime: windowStart });
      return {
        success: true,
        remaining: config.maxRequests - 1,
        resetTime: windowStart,
      };
    }

    if (existing.count >= config.maxRequests) {
      // Rate limit exceeded
      return {
        success: false,
        remaining: 0,
        resetTime: existing.resetTime,
      };
    }

    // Increment count
    existing.count++;
    return {
      success: true,
      remaining: config.maxRequests - existing.count,
      resetTime: existing.resetTime,
    };
  }
}

/**
 * KV-based rate limiter for production
 */
class KVRateLimiter {
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowStart = now + config.windowMs;
      const fullKey = `${config.keyPrefix || 'ratelimit'}:${key}`;

      // Get current count
      const current = await kv.get<{ count: number; resetTime: number }>(fullKey);

      if (!current || now > current.resetTime) {
        // First request or window expired
        await kv.set(fullKey, { count: 1, resetTime: windowStart }, {
          px: config.windowMs,
        });
        return {
          success: true,
          remaining: config.maxRequests - 1,
          resetTime: windowStart,
        };
      }

      if (current.count >= config.maxRequests) {
        // Rate limit exceeded
        return {
          success: false,
          remaining: 0,
          resetTime: current.resetTime,
        };
      }

      // Increment count
      const newCount = current.count + 1;
      await kv.set(fullKey, { count: newCount, resetTime: current.resetTime }, {
        px: current.resetTime - now,
      });

      return {
        success: true,
        remaining: config.maxRequests - newCount,
        resetTime: current.resetTime,
      };
    } catch (error) {
      apiLogger.error('KV rate limiter error', { error, key });
      // Fallback: allow request on error
      return {
        success: true,
        remaining: config.maxRequests - 1,
        resetTime: Date.now() + config.windowMs,
      };
    }
  }
}

// Choose limiter based on environment
const rateLimiter = process.env.KV_URL 
  ? new KVRateLimiter() 
  : new InMemoryRateLimiter();

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  reddit: {
    maxRequests: 60, // 60 requests per hour
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'reddit-api',
  },
  general: {
    maxRequests: 100, // 100 requests per 15 minutes
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'general-api',
  },
} as const;

/**
 * Apply rate limiting to a request
 * @param identifier - Unique identifier for the client (IP, user ID, etc.)
 * @param configKey - Which rate limit config to use
 */
export async function applyRateLimit(
  identifier: string,
  configKey: keyof typeof rateLimitConfigs = 'general'
): Promise<RateLimitResult> {
  const config = rateLimitConfigs[configKey];
  const result = await rateLimiter.check(identifier, config);
  
  apiLogger.debug('Rate limit check', {
    identifier,
    configKey,
    result,
  });

  return result;
}

/**
 * Get client identifier from request
 * Uses IP address as fallback
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
  return ip.trim();
}