import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './requireAuth';
import { IFamilyRepository } from '../repositories/IFamilyRepository';
import { FirestoreFamilyRepository } from '../repositories/FirestoreFamilyRepository';

const defaultFamilyRepository: IFamilyRepository = new FirestoreFamilyRepository();

/**
 * Middleware que verifica se o usuário autenticado possui CPF regularizado.
 * Rejeita com status 403 e código USER_CPF_REQUIRED caso o CPF esteja pendente.
 */
export function createRequireUserCpf(
  familyRepository: IFamilyRepository = defaultFamilyRepository
) {
  return async (
    req: AuthenticatedRequest,
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
      const userDoc = await familyRepository.getUser(authUser.uid);
      if (!userDoc || !userDoc.cpfMasked) {
        res.status(403).json({
          error: 'Acesso bloqueado: regularização de CPF pendente na conta de usuário.',
          code: 'USER_CPF_REQUIRED',
          needsUserCpf: true,
        });
        return;
      }

      next();
    } catch (error: any) {
      console.error('[requireUserCpf] Erro ao consultar cadastro do usuário:', error?.message || error);
      res.status(500).json({
        error: 'Erro interno ao validar dados cadastrais do usuário',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

export const requireUserCpf = createRequireUserCpf();
