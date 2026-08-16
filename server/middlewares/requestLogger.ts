import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface LoggedRequest extends Request {
  requestId?: string;
  startTime?: number;
}

/**
 * Sanitized Operational Request Logger Middleware
 *
 * Logs structured operational metrics without logging PII:
 * - NO Firebase UID
 * - NO patientId
 * - NO familyId
 * - NO email
 * - NO name
 * - NO clinical content
 * - NO request body
 * - NO Authorization header / Bearer token / ID token / invitation token
 *
 * Preserves:
 * - requestId
 * - method
 * - route (normalized)
 * - status
 * - durationMs
 * - authenticated (boolean)
 * - authorized (boolean)
 * - role (family role when applicable)
 */
export function requestLogger(req: LoggedRequest, res: Response, next: NextFunction): void {
  // Attach requestId and startTime
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Set response header for traceability without exposing internal details
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    // Only log API requests or errors
    if (!req.originalUrl.startsWith('/api') && res.statusCode < 400) {
      return;
    }

    const durationMs = req.startTime ? Date.now() - req.startTime : 0;
    const authUser = (req as any).user;
    const membership = (req as any).membership;

    // Normalize route path to prevent leaking IDs in URL params
    const normalizedRoute = req.baseUrl || req.originalUrl.split('?')[0];

    const logEntry: Record<string, any> = {
      requestId,
      method: req.method,
      route: normalizedRoute,
      status: res.statusCode,
      durationMs,
      authenticated: Boolean(authUser?.uid),
      authorized: res.statusCode !== 401 && res.statusCode !== 403,
    };

    if (membership?.role) {
      logEntry.role = membership.role;
    }

    console.log(JSON.stringify(logEntry));
  });

  next();
}
