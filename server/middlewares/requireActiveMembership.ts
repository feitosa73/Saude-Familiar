import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './requireAuth';
import { Family, FamilyMembership } from '../types';
import { IFamilyRepository } from '../repositories/IFamilyRepository';
import { FirestoreFamilyRepository } from '../repositories/FirestoreFamilyRepository';

export interface AuthorizedFamilyRequest extends AuthenticatedRequest {
  membership?: FamilyMembership;
  family?: Family;
}

const defaultFamilyRepository: IFamilyRepository = new FirestoreFamilyRepository();

export function createRequireActiveMembership(
  familyRepository: IFamilyRepository = defaultFamilyRepository
) {
  return async (
    req: AuthorizedFamilyRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authUser = req.user;

    if (!authUser || !authUser.uid) {
      res.status(401).json({
        error: 'Unauthorized: Usuário não autenticado',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    try {
      // Lookup membership in Firestore strictly by Firebase Auth UID
      const membership = await familyRepository.findMembershipByUserId(authUser.uid);

      if (!membership) {
        console.warn(`[AuthZ] Access denied: No membership found for uid=${authUser.uid}`);
        res.status(403).json({
          error: 'Acesso negado: usuário não possui vínculo com nenhuma família',
          code: 'NO_MEMBERSHIP',
        });
        return;
      }

      if (membership.status === 'pending') {
        console.warn(`[AuthZ] Access denied: Pending membership for uid=${authUser.uid}`);
        res.status(403).json({
          error: 'Acesso pendente de aprovação pelo administrador',
          code: 'MEMBERSHIP_PENDING',
        });
        return;
      }

      if (membership.status === 'disabled') {
        console.warn(`[AuthZ] Access denied: Disabled membership for uid=${authUser.uid}`);
        res.status(403).json({
          error: 'Acesso desativado nesta família',
          code: 'MEMBERSHIP_DISABLED',
        });
        return;
      }

      if (membership.status !== 'active') {
        console.warn(
          `[AuthZ] Access denied: Inactive membership (${membership.status}) for uid=${authUser.uid}`
        );
        res.status(403).json({
          error: 'Acesso não ativo',
          code: 'MEMBERSHIP_INACTIVE',
        });
        return;
      }

      // Fetch family entity
      const family = await familyRepository.getFamily(membership.familyId);
      if (!family) {
        console.warn(
          `[AuthZ] Access denied: Family ${membership.familyId} not found for uid=${authUser.uid}`
        );
        res.status(403).json({
          error: 'Família associada não encontrada',
          code: 'FAMILY_NOT_FOUND',
        });
        return;
      }

      req.membership = membership;
      req.family = family;
      next();
    } catch (error: any) {
      const isFirestoreUnavailable =
        error?.message?.includes('Cloud Firestore API has not been used') ||
        error?.message?.includes('PERMISSION_DENIED') ||
        error?.code === 7;

      if (isFirestoreUnavailable) {
        console.warn('[AuthZ] Firestore não provisionado/habilitado no GCP. Retornando 503.');
        res.status(503).json({
          error:
            'A API Cloud Firestore não está habilitada ou o banco ainda não foi provisionado no projeto GCP.',
          code: 'FIRESTORE_NOT_INITIALIZED',
        });
        return;
      }

      console.error('[AuthZ] Erro ao validar membership no Firestore:', error);
      res.status(500).json({
        error: 'Erro interno ao validar autorização de acesso',
        code: 'AUTHZ_ERROR',
      });
    }
  };
}

export const requireActiveMembership = createRequireActiveMembership();
