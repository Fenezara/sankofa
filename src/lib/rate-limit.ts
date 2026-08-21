/**
 * Sankofa — Rate limiting (in-memory, MVP)
 * 20 messages/minute per identifier (anonymousId or userId).
 * Production: replace with Redis.
 */

const requests = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  identifier: string,
  limit: number = 20,
  windowMs: number = 60000,
): { success: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = requests.get(identifier);

  if (!record || now > record.resetTime) {
    requests.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { success: true, remaining: limit - record.count, resetIn: record.resetTime - now };
}
