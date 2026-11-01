import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  ShoppingBag,
  History,
  Info,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  CreditCard,
  QrCode,
  ExternalLink,
  Loader2,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import { AiWalletSummary, AiWalletLedgerEntry, PaymentOrderStatus } from '../types';

interface AiWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletUpdated?: (wallet: AiWalletSummary) => void;
}

interface PendingPayment {
  orderId: string;
  checkoutUrl: string;
  stripeSessionId: string;
  status: PaymentOrderStatus;
  startedAt: number;
}

export const AiWalletModal: React.FC<AiWalletModalProps> = ({
  isOpen,
  onClose,
  onWalletUpdated,
}) => {
  const [wallet, setWallet] = useState<AiWalletSummary | null>(null);
  const [history, setHistory] = useState<AiWalletLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  const pollIntervalRef = useRef<any>(null);

  const loadWalletData = async () => {
    setIsLoading(true);
    try {
      const [walletData, historyData] = await Promise.all([
        api.getAiWallet(),
        api.getAiWalletHistory(30),
      ]);
      setWallet(walletData);
      setHistory(historyData);
      if (onWalletUpdated) {
        onWalletUpdated(walletData);
      }
    } catch (err: any) {
      console.error('Erro ao carregar carteira:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Não foi possível carregar as informações da carteira.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Polling automático para acompanhamento da confirmação da Stripe via webhook
  const startPolling = (orderId: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const orderStatus = await api.getPaymentOrderStatus(orderId);
        if (orderStatus.status === 'PAID') {
          stopPolling();
          setPendingPayment(null);
          setFeedback({
            type: 'success',
            message: 'Pagamento confirmado com sucesso pela Stripe! 100 créditos de IA foram liberados na sua conta.',
          });
          await loadWalletData();
        } else if (orderStatus.status === 'FAILED' || orderStatus.status === 'EXPIRED') {
          stopPolling();
          setPendingPayment(null);
          setFeedback({
            type: 'error',
            message: 'O pagamento expirou ou não pôde ser concluído no gateway. Tente novamente.',
          });
        }
      } catch (err: any) {
        console.warn('[AiWalletModal] Erro ao consultar status do pedido:', err);
      }
    }, 3000);
  };

  // Verifica retorno de checkout pela URL (ex: ?status=success&order_id=...)
  useEffect(() => {
    if (isOpen) {
      loadWalletData();

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlStatus = urlParams.get('status');
        const urlOrderId = urlParams.get('order_id');

        if (urlOrderId) {
          if (urlStatus === 'success') {
            setFeedback({
              type: 'info',
              message: 'Retorno do checkout detectado! Verificando confirmação do pagamento junto à Stripe...',
            });
            startPolling(urlOrderId);
          } else if (urlStatus === 'cancelled') {
            setFeedback({
              type: 'info',
              message: 'O processo de pagamento foi cancelado na Stripe antes da conclusão.',
            });
          }
          // Limpa os parâmetros da URL para evitar reapresentação em refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } else {
      stopPolling();
      setPendingPayment(null);
      setFeedback(null);
    }

    return () => {
      stopPolling();
    };
  }, [isOpen]);

  // Criação da sessão autoritativa de checkout na Stripe
  const handleInitiateCheckout = async () => {
    setIsCreatingCheckout(true);
    setFeedback(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const result = await api.createWalletCheckoutSession(origin);

      const pending: PendingPayment = {
        orderId: result.orderId,
        checkoutUrl: result.checkoutUrl,
        stripeSessionId: result.stripeSessionId,
        status: 'PENDING',
        startedAt: Date.now(),
      };

      setPendingPayment(pending);
      startPolling(result.orderId);

      // Redireciona para a página segura de pagamento da Stripe
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
    } catch (err: any) {
      console.error('Falha ao criar checkout de créditos:', err);
      setFeedback({
        type: 'error',
        message:
          err.message ||
          'Falha ao conectar com o gateway de pagamentos da Stripe. Verifique as credenciais no servidor.',
      });
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-blue-50/70 via-indigo-50/50 to-white dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="wallet-modal-title"
                className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
              >
                Carteira de Créditos de IA
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Uso sob demanda para reconhecimento inteligente de receitas, exames e guias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            Visão Geral e Saldo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            Extrato de Movimentações ({history.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Feedback alert */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : feedback.type === 'info'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : feedback.type === 'info' ? (
                <Clock className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{feedback.message}</div>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs underline opacity-80 hover:opacity-100 cursor-pointer"
              >
                Dispensar
              </button>
            </div>
          )}

          {isLoading && !wallet ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium">Carregando carteira de créditos...</p>
            </div>
          ) : activeTab === 'overview' ? (
            <>
              {/* Balance Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Total Balance */}
                <div className="bg-linear-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between opacity-90 text-xs font-semibold uppercase tracking-wider">
                    <span>Saldo Total</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="my-2">
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                      {wallet?.totalBalance ?? 0}
                    </span>
                    <span className="text-sm font-medium ml-1.5 opacity-90">créditos</span>
                  </div>
                  <div className="text-xs opacity-80 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Uso exclusivo para IA</span>
                  </div>
                </div>

                {/* Promotional / Initial Grant */}
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    Bônus Inicial
                  </div>
                  <div className="my-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                      {wallet?.promotionalCredits ?? 0}
                    </span>
                    <span className="text-xs font-medium ml-1 text-slate-500 dark:text-slate-400">
                      concedidos
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Prioritário no consumo
                  </div>
                </div>

                {/* Purchased credits */}
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Comprados</span>
                    <span className="text-2xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-sm font-bold">
                      Não expiram
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                      {wallet?.purchasedCredits ?? 0}
                    </span>
                    <span className="text-xs font-medium ml-1 text-slate-500 dark:text-slate-400">
                      adquiridos
                    </span>
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Validade indeterminada</span>
                  </div>
                </div>
              </div>

              {/* Status: Aguardando Pagamento (quando há checkout em andamento) */}
              {pendingPayment && (
                <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700/80 bg-amber-50/70 dark:bg-amber-950/40 p-4.5 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                          Aguardando Pagamento
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          Aguardando confirmação oficial da Stripe...
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1">
                        Pedido <strong>#{pendingPayment.orderId}</strong> em processamento. Os créditos serão adicionados automaticamente assim que a Stripe confirmar a liquidação do Pix ou Cartão.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/60">
                    {pendingPayment.checkoutUrl && (
                      <a
                        href={pendingPayment.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ir para o Checkout da Stripe</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        stopPolling();
                        setPendingPayment(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline ml-auto cursor-pointer"
                    >
                      Cancelar acompanhamento
                    </button>
                  </div>
                </div>
              )}

              {/* Promotional Purchase Box with Stripe Checkout */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-200 dark:border-indigo-900 bg-linear-to-br from-indigo-50/70 via-blue-50/40 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white mb-2 shadow-2xs">
                      <Sparkles className="w-3 h-3" />
                      OFERTA PROMOCIONAL
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      Lote de 100 Créditos de IA
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-md">
                      Recarregue sua carteira com valor promocional. Os créditos comprados{' '}
                      <strong>nunca expiram</strong> e ficam vinculados à sua conta.
                    </p>
                    <div className="mt-2 text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 flex items-baseline gap-2">
                      <span>R$ 50,00</span>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        (R$ 0,50 por crédito)
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Cartão de Crédito
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Pix com aprovação imediata
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      id="btn-buy-credit-lot"
                      onClick={handleInitiateCheckout}
                      disabled={isCreatingCheckout || Boolean(pendingPayment) || wallet?.isStripeConfigured === false}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer min-h-[46px]"
                    >
                      {isCreatingCheckout ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Redirecionando para Stripe...</span>
                        </>
                      ) : pendingPayment ? (
                        <>
                          <Clock className="w-4 h-4" />
                          <span>Aguardando Pagamento</span>
                        </>
                      ) : wallet?.isStripeConfigured === false ? (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Stripe não configurado</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          <span>Comprar 100 créditos</span>
                        </>
                      )}
                    </button>

                    <div className="text-2xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Checkout Oficial Stripe (SSL 256-bit)</span>
                    </div>
                  </div>
                </div>

                {wallet && wallet.isStripeConfigured === false && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Aviso de Configuração:</strong> O gateway Stripe ainda não possui as chaves de API (<code className="font-mono text-2xs bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code>) configuradas no ambiente. Para processar cobranças reais via Cartão e Pix, configure as credenciais no servidor. A adição de créditos sem pagamento foi desativada.
                    </div>
                  </div>
                )}
              </div>

              {/* Table of Operations & Costs */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Tabela de Consumo por Operação
                  </h4>
                  <span className="text-2xs text-slate-500 dark:text-slate-400">Zero-Charge on Error</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Leitura de comprovante/guia de agendamento
                    </span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                      1 crédito
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      OCR de receita e prescrição médica
                    </span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                      2 créditos
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Análise estruturada de laudo de exame
                    </span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                      3 créditos
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Geração de resumo clínico integrado
                    </span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                      4 créditos
                    </span>
                  </div>
                </div>

                <div className="pt-1 text-2xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200/60 dark:border-slate-700/60">
                  💡 <strong>Garantia de estorno automático:</strong> Se o processamento de IA falhar ou o arquivo estiver ilegível, os créditos são imediatamente devolvidos ao seu saldo. O cadastro e preenchimento manual de exames, medicamentos e consultas é 100% gratuito e ilimitado.
                </div>
              </div>
            </>
          ) : (
            /* History / Ledger Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Extrato das últimas movimentações</span>
                <button
                  type="button"
                  onClick={loadWalletData}
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <History className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Nenhuma movimentação registrada
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Os créditos concedidos e consumidos serão listados aqui.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map((entry) => {
                    const isPositive = entry.amount > 0;
                    const isRefund = entry.type === 'REFUND_COMPENSATION';
                    return (
                      <div
                        key={entry.id}
                        className="p-3.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isRefund
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : isPositive
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isRefund ? (
                              <RefreshCw className="w-4 h-4" />
                            ) : isPositive ? (
                              <ArrowDownRight className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {entry.description}
                            </div>
                            <div className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{formatDate(entry.createdAt)}</span>
                              <span>•</span>
                              <span
                                className={`font-semibold ${
                                  entry.status === 'CONFIRMED'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : entry.status === 'REFUNDED'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {entry.status === 'CONFIRMED'
                                  ? 'Confirmado'
                                  : entry.status === 'REFUNDED'
                                  ? 'Estornado'
                                  : 'Pendente'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-sm sm:text-base font-extrabold ${
                              isRefund
                                ? 'text-amber-600 dark:text-amber-400'
                                : isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {isPositive ? `+${entry.amount}` : entry.amount}
                          </div>
                          <div className="text-2xs text-slate-500 dark:text-slate-400">
                            Saldo: {entry.balanceAfter}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Privacidade total: nenhum dado clínico é gravado na carteira.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
