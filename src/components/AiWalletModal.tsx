import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { api } from '../services/api';
import { AiWalletSummary, AiWalletLedgerEntry } from '../types';

interface AiWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletUpdated?: (wallet: AiWalletSummary) => void;
}

export const AiWalletModal: React.FC<AiWalletModalProps> = ({
  isOpen,
  onClose,
  onWalletUpdated,
}) => {
  const [wallet, setWallet] = useState<AiWalletSummary | null>(null);
  const [history, setHistory] = useState<AiWalletLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  const loadWalletData = async () => {
    setIsLoading(true);
    setFeedback(null);
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

  useEffect(() => {
    if (isOpen) {
      loadWalletData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimulatePurchase = async () => {
    setIsPurchasing(true);
    setFeedback(null);
    try {
      const result = await api.simulatePurchaseWalletLot();
      setWallet(result);
      if (onWalletUpdated) {
        onWalletUpdated(result);
      }
      setFeedback({
        type: 'success',
        message: 'Lote promocional de 100 créditos adicionado com sucesso! Seus créditos comprados não expiram.',
      });
      // Recarrega extrato
      const updatedHistory = await api.getAiWalletHistory(30);
      setHistory(updatedHistory);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Falha ao processar aquisição do lote promocional.',
      });
    } finally {
      setIsPurchasing(false);
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
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
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

              {/* Promotional Purchase Box */}
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
                  </div>

                  <button
                    type="button"
                    id="btn-buy-credit-lot"
                    onClick={handleSimulatePurchase}
                    disabled={isPurchasing}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer min-h-[46px] shrink-0"
                  >
                    {isPurchasing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>Comprar 100 créditos</span>
                      </>
                    )}
                  </button>
                </div>
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
