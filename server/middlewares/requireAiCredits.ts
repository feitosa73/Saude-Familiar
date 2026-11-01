import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from './requireAuth';
import {
  CreditWalletService,
  InsufficientCreditsError,
} from '../services/creditWalletService';
import { AiOperationType } from '../config/aiOperationsConfig';

export interface AiCreditRequest extends AuthenticatedRequest {
  aiCreditReservation?: {
    reserved: boolean;
    ledgerId: string;
    cost: number;
    balanceAfter: number;
    isIdempotentReplay?: boolean;
  };
}

export function createRequireAiCredits(
  walletService: CreditWalletService,
  operationType: AiOperationType
) {
  return async (req: AiCreditRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
    }

    const headerOpId = req.headers['x-operation-id'];
    const bodyOpId = req.body?.operationId;
    const operationId = (typeof headerOpId === 'string' && headerOpId.trim())
      ? headerOpId.trim()
      : (typeof bodyOpId === 'string' && bodyOpId.trim())
      ? bodyOpId.trim()
      : `op_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const patientId = req.params?.patientId;

    try {
      const reservation = await walletService.reserveCredits(userId, {
        operationId,
        operationType,
        patientId,
      });

      req.aiCreditReservation = reservation;

      // Intercepta res.json para aplicar o padrão Two-Phase Commit / Zero-Charge on Error
      const originalJson = res.json.bind(res);
      let finalized = false;

      res.json = (body: any) => {
        if (!finalized && !reservation.isIdempotentReplay) {
          finalized = true;
          const status = res.statusCode || 200;
          if (status >= 200 && status < 300) {
            walletService.confirmCredits(userId, reservation.ledgerId).catch((err) => {
              console.error('[requireAiCredits] Falha ao confirmar créditos:', err);
            });
          } else {
            const reason = body?.error || `Falha na requisição (HTTP ${status})`;
            walletService.refundCredits(userId, reservation.ledgerId, reason).catch((err) => {
              console.error('[requireAiCredits] Falha ao estornar créditos:', err);
            });
          }
        }
        return originalJson(body);
      };

      // Se a conexão for abortada antes da resposta
      res.on('close', () => {
        if (!finalized && !res.writableEnded && !reservation.isIdempotentReplay) {
          finalized = true;
          walletService
            .refundCredits(userId, reservation.ledgerId, 'Conexão encerrada antes do término do processamento')
            .catch((err) => {
              console.error('[requireAiCredits] Falha ao estornar créditos após abort:', err);
            });
        }
      });

      next();
    } catch (error: any) {
      if (error instanceof InsufficientCreditsError || error?.code === 'INSUFFICIENT_AI_CREDITS') {
        return res.status(402).json({
          error: error.message,
          code: 'INSUFFICIENT_AI_CREDITS',
          requiredCredits: error.requiredCredits,
          availableCredits: error.availableCredits,
        });
      }

      console.error('[requireAiCredits] Erro ao reservar créditos:', error);
      return res.status(500).json({
        error: 'Erro interno ao validar saldo de créditos de IA.',
        code: 'WALLET_RESERVATION_ERROR',
      });
    }
  };
}
