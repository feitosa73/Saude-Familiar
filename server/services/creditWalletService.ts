import crypto from 'crypto';
import { IFamilyRepository } from '../repositories/IFamilyRepository';
import {
  AiWalletSummary,
  AiWalletLedgerEntry,
  LedgerEntryStatus,
} from '../types';
import {
  AiOperationType,
  getAiOperationCost,
  getAiOperationLabel,
  AI_INITIAL_GRANT_CREDITS,
  AI_LOT_PURCHASE_CONFIG,
} from '../config/aiOperationsConfig';

export class InsufficientCreditsError extends Error {
  public code = 'INSUFFICIENT_AI_CREDITS';
  public requiredCredits: number;
  public availableCredits: number;

  constructor(requiredCredits: number, availableCredits: number) {
    super(
      `Saldo insuficiente de créditos de IA. Necessário: ${requiredCredits}, disponível: ${availableCredits}.`
    );
    this.name = 'InsufficientCreditsError';
    this.requiredCredits = requiredCredits;
    this.availableCredits = availableCredits;
  }
}

export class CreditWalletService {
  constructor(private familyRepo: IFamilyRepository) {}

  /**
   * Obtém a carteira do usuário ou inicializa com a concessão inicial única de 100 créditos.
   */
  async ensureWallet(userId: string): Promise<AiWalletSummary> {
    const existing = await this.familyRepo.getWallet(userId);
    if (existing && existing.initialGrantClaimed) {
      return existing;
    }

    const now = new Date().toISOString();
    const newWallet: AiWalletSummary = {
      userId,
      promotionalCredits: AI_INITIAL_GRANT_CREDITS,
      purchasedCredits: 0,
      totalBalance: AI_INITIAL_GRANT_CREDITS,
      initialGrantClaimed: true,
      initialGrantClaimedAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.familyRepo.saveWallet(newWallet);

    const initialLedgerEntry: AiWalletLedgerEntry = {
      id: `led_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      type: 'INITIAL_GRANT',
      status: 'CONFIRMED',
      amount: AI_INITIAL_GRANT_CREDITS,
      balanceAfter: AI_INITIAL_GRANT_CREDITS,
      description: `Bônus de boas-vindas: ${AI_INITIAL_GRANT_CREDITS} créditos de IA`,
      createdAt: now,
    };

    await this.familyRepo.saveLedgerEntry(initialLedgerEntry);

    return newWallet;
  }

  async getWallet(userId: string): Promise<AiWalletSummary> {
    return this.ensureWallet(userId);
  }

  /**
   * Reserva e debita temporariamente os créditos antes de acionar o serviço de IA.
   * Adota o Two-Phase Ledger Pattern para proteção contra falhas e estornos.
   */
  async reserveCredits(
    userId: string,
    params: {
      operationId: string;
      operationType: AiOperationType;
      patientId?: string;
      description?: string;
    }
  ): Promise<{
    reserved: boolean;
    ledgerId: string;
    cost: number;
    balanceAfter: number;
    isIdempotentReplay?: boolean;
  }> {
    const { operationId, operationType, patientId, description } = params;

    // 1. Verificação de Idempotência
    const existingEntry = await this.familyRepo.findLedgerEntryByOperationId(userId, operationId);
    if (existingEntry) {
      if (existingEntry.status === 'CONFIRMED') {
        return {
          reserved: true,
          ledgerId: existingEntry.id,
          cost: Math.abs(existingEntry.amount),
          balanceAfter: existingEntry.balanceAfter,
          isIdempotentReplay: true,
        };
      }
      if (existingEntry.status === 'PENDING') {
        return {
          reserved: true,
          ledgerId: existingEntry.id,
          cost: Math.abs(existingEntry.amount),
          balanceAfter: existingEntry.balanceAfter,
          isIdempotentReplay: true,
        };
      }
    }

    const wallet = await this.ensureWallet(userId);
    const cost = getAiOperationCost(operationType);

    if (wallet.totalBalance < cost) {
      throw new InsufficientCreditsError(cost, wallet.totalBalance);
    }

    // 2. Ordem de consumo: primeiro créditos promocionais/concedidos, depois comprados
    let promoDebit = 0;
    let purchasedDebit = 0;

    if (wallet.promotionalCredits >= cost) {
      promoDebit = cost;
    } else {
      promoDebit = wallet.promotionalCredits;
      purchasedDebit = cost - promoDebit;
    }

    wallet.promotionalCredits -= promoDebit;
    wallet.purchasedCredits -= purchasedDebit;
    wallet.totalBalance -= cost;
    wallet.updatedAt = new Date().toISOString();
    wallet.version = (wallet.version || 1) + 1;

    await this.familyRepo.saveWallet(wallet);

    // 3. Registro no Ledger em status PENDING
    const ledgerId = `led_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ledgerEntry: AiWalletLedgerEntry = {
      id: ledgerId,
      userId,
      type: 'CONSUMPTION',
      status: 'PENDING',
      amount: -cost,
      balanceAfter: wallet.totalBalance,
      promotionalDebited: promoDebit,
      purchasedDebited: purchasedDebit,
      operationId,
      operationType,
      patientId,
      description: description || `Consumo de IA: ${getAiOperationLabel(operationType)}`,
      createdAt: new Date().toISOString(),
    };

    await this.familyRepo.saveLedgerEntry(ledgerEntry);

    return {
      reserved: true,
      ledgerId,
      cost,
      balanceAfter: wallet.totalBalance,
    };
  }

  /**
   * Confirma a transação após conclusão com sucesso da geração de IA.
   */
  async confirmCredits(userId: string, ledgerId: string): Promise<void> {
    await this.familyRepo.updateLedgerEntryStatus(userId, ledgerId, 'CONFIRMED');
  }

  /**
   * Estorna integralmente os créditos se a IA externa falhar (Zero-Charge on Error).
   */
  async refundCredits(userId: string, ledgerId: string, reason: string): Promise<void> {
    const entries = await this.familyRepo.getLedgerEntries(userId, 100);
    const entry = entries.find((e) => e.id === ledgerId);

    if (!entry || entry.status === 'REFUNDED') {
      return;
    }

    const wallet = await this.ensureWallet(userId);
    const promoRefund = entry.promotionalDebited || 0;
    const purchasedRefund = entry.purchasedDebited || 0;
    const totalRefund = Math.abs(entry.amount);

    wallet.promotionalCredits += promoRefund;
    wallet.purchasedCredits += purchasedRefund;
    wallet.totalBalance += totalRefund;
    wallet.updatedAt = new Date().toISOString();
    wallet.version = (wallet.version || 1) + 1;

    await this.familyRepo.saveWallet(wallet);
    await this.familyRepo.updateLedgerEntryStatus(userId, ledgerId, 'REFUNDED', reason);

    const compensationEntry: AiWalletLedgerEntry = {
      id: `led_ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      type: 'REFUND_COMPENSATION',
      status: 'CONFIRMED',
      amount: totalRefund,
      balanceAfter: wallet.totalBalance,
      operationId: entry.operationId,
      operationType: entry.operationType,
      patientId: entry.patientId,
      description: `Estorno por falha no processamento de IA: ${reason}`,
      createdAt: new Date().toISOString(),
      errorMessage: reason,
    };

    await this.familyRepo.saveLedgerEntry(compensationEntry);
  }

  /**
   * Credita um lote comprado de créditos (100 créditos por R$ 50,00).
   * Créditos comprados nunca expiram.
   */
  async creditPurchasedLot(
    userId: string,
    credits: number = AI_LOT_PURCHASE_CONFIG.credits,
    paymentReference: string = 'sandbox-test'
  ): Promise<AiWalletSummary> {
    const wallet = await this.ensureWallet(userId);
    const now = new Date().toISOString();

    wallet.purchasedCredits += credits;
    wallet.totalBalance += credits;
    wallet.updatedAt = now;
    wallet.version = (wallet.version || 1) + 1;

    await this.familyRepo.saveWallet(wallet);

    const purchaseEntry: AiWalletLedgerEntry = {
      id: `led_buy_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      type: 'PURCHASE',
      status: 'CONFIRMED',
      amount: credits,
      balanceAfter: wallet.totalBalance,
      description: `Aquisição de lote: ${credits} créditos de IA (Promocional R$ 50,00)`,
      createdAt: now,
      operationId: paymentReference,
    };

    await this.familyRepo.saveLedgerEntry(purchaseEntry);

    return wallet;
  }

  /**
   * Retorna o histórico de movimentações da carteira do usuário.
   */
  async getLedgerHistory(userId: string, limit: number = 50): Promise<AiWalletLedgerEntry[]> {
    await this.ensureWallet(userId);
    return this.familyRepo.getLedgerEntries(userId, limit);
  }
}
