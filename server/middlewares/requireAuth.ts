import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from '../lib/firebaseAdmin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized: Cabeçalho Authorization ausente' });
    return;
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    res.status(401).json({ error: 'Unauthorized: Formato do esquema Bearer inválido' });
    return;
  }

  const idToken = parts[1].trim();
  if (!idToken || idToken === 'null' || idToken === 'undefined' || idToken.length < 20) {
    res.status(401).json({ error: 'Unauthorized: Token de autenticação ausente ou inválido' });
    return;
  }

  try {
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    // Identity derived exclusively from the verified token
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };

    // Minimal operational log without tokens or headers
    console.log('[Auth] authentication=success');

    next();
  } catch (error: any) {
    // Minimal operational log for failures
    const errorCode = error?.code || 'token_verification_failed';
    console.warn(`[Auth] authentication=invalid_token reason=${errorCode}`);

    res.status(401).json({
      error: 'Unauthorized: Token de autenticação inválido ou expirado',
    });
  }
}
