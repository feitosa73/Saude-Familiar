import React from 'react';
import { ItemAgenda } from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  AlertCircle,
  CheckCircle,
  FileCheck,
  Share2,
  Edit2,
  Trash2,
  Stethoscope,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

interface AgendaCardProps {
  item: ItemAgenda;
  onEdit: (item: ItemAgenda) => void;
  onDelete: (item: ItemAgenda) => void;
  onShare: (item: ItemAgenda) => void;
  onViewDocument?: (docId: string) => void;
}

export const AgendaCard: React.FC<AgendaCardProps> = ({
  item,
  onEdit,
  onDelete,
  onShare,
  onViewDocument,
}) => {
  const isConsulta = item.tipo === 'consulta';
  const isRealizado = item.status === 'realizado';
  const isPendente = item.ehAlertaPendente;

  // Determinação da cor do Card com base no prazo conforme solicitado pelo usuário
  const prazo = item.prazoStatus || (
    item.ehAlertaPendente
      ? 'chegando'
      : item.dataHora
      ? (() => {
          const diffDays = Math.round(
            (new Date(item.dataHora).getTime() - new Date().setHours(0, 0, 0, 0)) /
              (1000 * 60 * 60 * 24)
          );
          if (diffDays < 0) return 'atrasado';
          if (diffDays <= 3) return 'chegando';
          return 'no_prazo';
        })()
      : 'chegando'
  );

  let cardStyle = 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs hover:shadow-xs';
  let badgePrazoStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';

  if (isRealizado) {
    cardStyle = 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 opacity-90';
    badgePrazoStyle = 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
  } else if (prazo === 'atrasado') {
    // Vermelho claro se já passou da data
    cardStyle = 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100 shadow-xs ring-1 ring-rose-200/60 dark:ring-rose-800/40';
    badgePrazoStyle = 'bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 font-bold';
  } else if (prazo === 'chegando') {
    // Amarelo se estiver chegando a data ou pendente
    cardStyle = 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 shadow-xs ring-1 ring-amber-200/70 dark:ring-amber-800/40';
    badgePrazoStyle = 'bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold';
  } else if (prazo === 'no_prazo') {
    // Verde claro se estiver no prazo
    cardStyle = 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300/90 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 shadow-xs ring-1 ring-emerald-200/60 dark:ring-emerald-800/40';
    badgePrazoStyle = 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-bold';
  }

  return (
    <article
      id={`agenda-card-${item.id}`}
      className={`rounded-2xl border transition-all p-5 sm:p-6 relative ${cardStyle}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Cabeçalho e Informações Principais */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs sm:text-sm ${
                isConsulta ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isConsulta ? (
                <>
                  <Stethoscope className="w-4 h-4" />
                  <span>Consulta Médica</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <span>Exame Diagnóstico</span>
                </>
              )}
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
            <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
              {item.statusRotulo}
            </span>
            {item.prazoRotulo && !isRealizado && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${badgePrazoStyle}`}>
                  {item.prazoRotulo}
                </span>
              </>
            )}
            {item.categoriaOuEspecialidade && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs sm:text-sm">{item.categoriaOuEspecialidade}</span>
              </>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {item.titulo}
          </h3>

          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium">
            <User className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="truncate">{item.subtitulo}</span>
          </div>
        </div>

        {/* Bloco de Data e Horário em Destaque */}
        <div className="sm:text-right shrink-0 flex items-center sm:items-end justify-between sm:justify-start gap-2.5">
          {item.possuiDataDefinida && item.dataHora ? (
            <div className={`inline-flex sm:flex-col items-center sm:items-end gap-1.5 px-3.5 py-2 rounded-xl border ${badgePrazoStyle}`}>
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{item.dataExibicao || item.dataHora.split('T')[0]}</span>
              </div>
              {item.dataHora.includes('T') && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold font-mono">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.horarioExibicao || item.dataHora.split('T')[1].slice(0, 5)}</span>
                </div>
              )}
            </div>
          ) : item.categoriaAlerta === 'resultado_disponivel' ? (
            <div className="inline-flex items-center gap-2 bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700 px-3.5 py-2 rounded-xl text-sm font-bold shadow-2xs">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Laudo Liberado</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700 px-3.5 py-2 rounded-xl text-sm font-bold shadow-2xs">
              <AlertCircle className="w-4.5 h-4.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>Data a Definir</span>
            </div>
          )}

          {/* Ações Rápidas (Desktop / Topo, >= 44px) */}
          <div className="flex items-center gap-1 sm:ml-2">
            <button
              onClick={() => onEdit(item)}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Editar agendamento"
            >
              <Edit2 className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              title="Excluir agendamento"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Caixa de Alerta Contextual da Pendência */}
      {isPendente && item.motivoAlerta && (
        <div
          className={`mt-4 p-3.5 rounded-xl text-sm sm:text-base flex items-start gap-3 border ${
            item.categoriaAlerta === 'resultado_disponivel'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
              : item.categoriaAlerta === 'previsao_resultado_vencida'
              ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
              : 'bg-amber-100/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
          }`}
        >
          {item.categoriaAlerta === 'resultado_disponivel' ? (
            <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                item.categoriaAlerta === 'previsao_resultado_vencida' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
              }`}
            />
          )}
          <div className="space-y-1">
            <span className="font-bold block text-sm sm:text-base">
              {item.categoriaAlerta === 'resultado_disponivel'
                ? 'Laudo Liberado pelo Laboratório:'
                : item.categoriaAlerta === 'previsao_resultado_vencida'
                ? 'Previsão Ultrapassada:'
                : item.categoriaAlerta === 'aguardando_agendamento'
                ? 'Aguardando Agendamento:'
                : 'Aguardando definição:'}
            </span>
            <p
              className={`leading-relaxed font-medium text-sm sm:text-base ${
                item.categoriaAlerta === 'resultado_disponivel'
                  ? 'text-emerald-950 dark:text-emerald-200'
                  : item.categoriaAlerta === 'previsao_resultado_vencida'
                  ? 'text-rose-950 dark:text-rose-200'
                  : 'text-amber-950 dark:text-amber-200'
              }`}
            >
              {item.motivoAlerta}
            </p>
          </div>
        </div>
      )}

      {/* Detalhes Complementares (Motivo / Observações) */}
      {(item.motivo || item.observacoes) && (
        <div className="mt-3.5 space-y-1.5 text-sm sm:text-base text-slate-700 dark:text-slate-300">
          {item.motivo && (
            <p className="line-clamp-2 leading-relaxed">
              <strong className="text-slate-900 dark:text-slate-100 font-bold">Motivo:</strong> {item.motivo}
            </p>
          )}
          {item.observacoes && (
            <p className="line-clamp-2 italic text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong className="text-slate-800 dark:text-slate-200 not-italic font-bold">Obs:</strong> {item.observacoes}
            </p>
          )}
        </div>
      )}

      {/* Portal e Credenciais no Card da Agenda */}
      {item.tipo === 'exame' && (item.portalUrl || item.temCredenciaisAcesso) && (
        <div className="mt-3 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-sm text-indigo-950 dark:text-indigo-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-bold text-indigo-950 dark:text-indigo-100">Acesso ao Laudo:</span>
            {item.temCredenciaisAcesso && (
              <span className="bg-indigo-100 dark:bg-indigo-900/80 text-indigo-900 dark:text-indigo-200 px-2 py-0.5 rounded text-xs font-bold border border-indigo-200 dark:border-indigo-700">
                Login e Senha salvos
              </span>
            )}
          </div>
          {item.portalUrl && (
            <a
              href={item.portalUrl.startsWith('http') ? item.portalUrl : `https://${item.portalUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-bold inline-flex items-center gap-1.5 text-xs sm:text-sm hover:underline"
            >
              <span>Portal de Resultados</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Rodapé com Local, Documento Vinculado e Botão Avisar Família */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
          {item.local && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="truncate max-w-[260px] font-medium">{item.local}</span>
            </div>
          )}

          {item.nomeDocumento && (
            <button
              onClick={() => onViewDocument && item.documentoId && onViewDocument(item.documentoId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 transition-colors truncate max-w-[260px] min-h-[38px] cursor-pointer"
              title="Visualizar laudo ou documento vinculado"
            >
              <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">{item.nomeDocumento}</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>

        {/* Botão Acessível de Avisar Família (Web Share API, >= 44px) */}
        <button
          onClick={() => onShare(item)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs min-h-[44px] cursor-pointer"
          title="Compartilhar ou avisar a família via WhatsApp/SMS"
        >
          <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Avisar Família</span>
        </button>
      </div>
    </article>
  );
};
