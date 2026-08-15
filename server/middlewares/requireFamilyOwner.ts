import { Response, NextFunction } from 'express';
import { AuthorizedFamilyRequest } from './requireActiveMembership';

export async function requireFamilyOwner(
  req: AuthorizedFamilyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const membership = req.membership;

  if (!membership || membership.role !== 'owner') {
    console.warn(
      `[AuthZ] Owner access denied: User ${req.user?.uid} has role '${membership?.role || 'none'}'`
    );
    res.status(403).json({
      error: 'Acesso restrito ao Administrador (Owner) da família',
      code: 'FORBIDDEN_OWNER_REQUIRED',
    });
    return;
  }

  next();
}
