import Stripe from 'stripe';
import { AI_LOT_PURCHASE_CONFIG } from '../config/aiOperationsConfig';
import { IFamilyRepository } from '../repositories/IFamilyRepository';
import { CreditWalletService } from './creditWalletService';
import { PaymentOrder, PaymentOrderStatus } from '../types';

export interface CheckoutSessionResult {
  order: PaymentOrder;
  checkoutUrl: string;
}

export interface WebhookProcessingResult {
  received: boolean;
  duplicate?: boolean;
  ignored?: boolean;
  reason?: string;
  releasedCredits?: number;
  order?: PaymentOrder | null;
}

export class StripePaymentService {
  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;

  constructor(
    private familyRepo: IFamilyRepository,
    private creditWalletService: CreditWalletService
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2023-10-16' as any,
      });
    }
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  }

  isStripeConfigured(): boolean {
    return Boolean(this.stripe);
  }

  /**
   * Cria uma sessão de checkout para aquisição de lote de créditos de IA.
   * Suporta Cartão de Crédito e Pix (BRL).
   * O pedido é registrado como PENDING. Nenhum crédito é liberado aqui!
   */
  async createCheckoutSession(
    userId: string,
    userEmail?: string,
    returnBaseUrl: string = 'http://localhost:3000'
  ): Promise<CheckoutSessionResult> {
    const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const amountCents = AI_LOT_PURCHASE_CONFIG.priceCents;
    const credits = AI_LOT_PURCHASE_CONFIG.credits;

    if (this.stripe) {
      try {
        const cleanBaseUrl = returnBaseUrl.replace(/\/+$/, '');
        const session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card', 'pix'],
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'brl',
                unit_amount: amountCents,
                product_data: {
                  name: `Lote de ${credits} Créditos de IA - Saúde Familiar`,
                  description: `Recarga avulsa de ${credits} créditos de Inteligência Artificial sem prazo de expiração.`,
                },
              },
              quantity: 1,
            },
          ],
          metadata: {
            userId,
            orderId,
            credits: credits.toString(),
          },
          customer_email: userEmail || undefined,
          success_url: `${cleanBaseUrl}/wallet?status=success&session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
          cancel_url: `${cleanBaseUrl}/wallet?status=cancelled&order_id=${orderId}`,
        } as any);

        const order: PaymentOrder = {
          id: orderId,
          userId,
          amountCents,
          currency: 'BRL',
          credits,
          status: 'PENDING',
          stripeSessionId: session.id,
          checkoutUrl: session.url || undefined,
          createdAt: now,
          updatedAt: now,
        };

        const savedOrder = await this.familyRepo.createPaymentOrder(order);
        return {
          order: savedOrder,
          checkoutUrl: session.url || `${cleanBaseUrl}/wallet?order_id=${orderId}`,
        };
      } catch (err: any) {
        console.error('[StripePaymentService] Erro ao criar checkout session via Stripe API:', err);
        throw new Error(`Falha na comunicação com o gateway Stripe: ${err.message || err}`);
      }
    }

    // Modo Sandbox / Teste quando chave Stripe não está configurada
    const cleanBaseUrl = returnBaseUrl.replace(/\/+$/, '');
    const simulatedSessionId = `cs_test_${orderId}`;
    const simulatedUrl = `${cleanBaseUrl}/wallet?test_checkout_session=${simulatedSessionId}&order_id=${orderId}`;

    const order: PaymentOrder = {
      id: orderId,
      userId,
      amountCents,
      currency: 'BRL',
      credits,
      status: 'PENDING',
      stripeSessionId: simulatedSessionId,
      checkoutUrl: simulatedUrl,
      createdAt: now,
      updatedAt: now,
    };

    const savedOrder = await this.familyRepo.createPaymentOrder(order);
    return {
      order: savedOrder,
      checkoutUrl: simulatedUrl,
    };
  }

  /**
   * Processa webhook oficial da Stripe assinado criptograficamente.
   * Concede créditos única e exclusivamente após a confirmação autoritativa do pagamento.
   * Garante idempotência: requisições repetidas não concedem créditos mais de uma vez.
   */
  async handleWebhookEvent(
    rawBody: Buffer | string,
    signature?: string
  ): Promise<WebhookProcessingResult> {
    let event: any;

    if (this.stripe && this.webhookSecret) {
      if (!signature) {
        throw new Error('Assinatura Stripe ausente no cabeçalho stripe-signature');
      }
      try {
        event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      } catch (err: any) {
        console.error('[StripePaymentService] Falha na validação de assinatura do webhook:', err.message);
        throw new Error(`Webhook Signature Verification Failed: ${err.message}`);
      }
    } else {
      // Test or development fallback without live webhook signing secret
      try {
        event = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf-8'));
      } catch (err: any) {
        throw new Error(`Payload de webhook inválido: ${err.message}`);
      }
    }

    // Processa eventos de sucesso de pagamento
    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const sessionOrIntent = event.data?.object;
      if (!sessionOrIntent) {
        return { received: true, ignored: true, reason: 'Objeto de dados ausente' };
      }

      const sessionId = sessionOrIntent.id;
      const orderIdFromMeta = sessionOrIntent.metadata?.orderId;
      const paymentIntentId = sessionOrIntent.payment_intent || sessionOrIntent.id;

      // Localiza a ordem correspondente
      let order: PaymentOrder | null = null;
      if (sessionId) {
        order = await this.familyRepo.getPaymentOrderByStripeSession(sessionId);
      }
      if (!order && orderIdFromMeta) {
        order = await this.familyRepo.getPaymentOrder(orderIdFromMeta);
      }

      if (!order) {
        console.warn(`[StripePaymentService] Ordem não localizada para evento ${event.type}: sessionId=${sessionId}, orderIdMeta=${orderIdFromMeta}`);
        return { received: true, ignored: true, reason: 'Ordem de pagamento não encontrada' };
      }

      // IDEMPOTÊNCIA: Se a ordem já foi marcada como PAID, não credita novamente!
      if (order.status === 'PAID') {
        console.info(`[StripePaymentService] Idempotência acionada: Ordem ${order.id} já está paga. Nenhuma duplicidade de créditos.`);
        return { received: true, duplicate: true, order };
      }

      // Atualiza status da ordem de pagamento para PAID
      const now = new Date().toISOString();
      const updatedOrder = await this.familyRepo.updatePaymentOrderStatus(
        order.id,
        'PAID',
        now,
        typeof paymentIntentId === 'string' ? paymentIntentId : undefined
      );

      // Concede os créditos comprados de forma autoritativa na carteira do usuário
      await this.creditWalletService.creditPurchasedLot(
        order.userId,
        order.credits,
        `stripe_${order.stripeSessionId}`
      );

      console.info(
        `[StripePaymentService] Pagamento aprovado! Ordem ${order.id} liberou ${order.credits} créditos para o usuário ${order.userId}.`
      );

      return {
        received: true,
        releasedCredits: order.credits,
        order: updatedOrder || order,
      };
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data?.object;
      const orderIdFromMeta = session?.metadata?.orderId;
      const sessionId = session?.id;

      let order: PaymentOrder | null = null;
      if (sessionId) order = await this.familyRepo.getPaymentOrderByStripeSession(sessionId);
      if (!order && orderIdFromMeta) order = await this.familyRepo.getPaymentOrder(orderIdFromMeta);

      if (order && order.status === 'PENDING') {
        await this.familyRepo.updatePaymentOrderStatus(order.id, 'EXPIRED');
      }
      return { received: true, ignored: false, reason: 'Sessão expirada' };
    }

    return { received: true, ignored: true, reason: `Evento não processado: ${event.type}` };
  }

  /**
   * Consulta o status atual de uma ordem de pagamento.
   * Garante que o solicitante seja o proprietário da ordem.
   */
  async getPaymentOrderStatus(orderId: string, requestingUserId: string): Promise<PaymentOrder | null> {
    const order = await this.familyRepo.getPaymentOrder(orderId);
    if (!order) return null;
    if (order.userId !== requestingUserId) {
      throw new Error('Acesso não autorizado a esta ordem de pagamento');
    }
    return order;
  }
}
