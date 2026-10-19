import React from 'react';
import { ItemAgenda } from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  AlertCircle,
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
  const isPendente = item.ehAlertaPendente;
  const isConsulta = item.tipo === 'consulta';

  return (
    <article
      id={`agenda-card-${item.id}`}
      className={`rounded-2xl border transition-all p-4 sm:p-5 relative ${
        isPendente
          ? 'bg-amber-50/90 border-amber-300/90 text-amber-950 shadow-xs ring-1 ring-amber-200/50'
          : 'bg-white border-slate-200/90 hover:border-slate-300 text-slate-900 shadow-2xs hover:shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Cabeçalho e Informações Principais */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span
              className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[11px] ${
                isConsulta ? 'text-blue-700' : 'text-emerald-700'
              }`}
            >
              {isConsulta ? (
                <>
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Consulta Médica</span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  <span>Exame Diagnóstico</span>
                </>
              )}
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span
              className={`font-semibold text-xs ${
                isPendente ? 'text-amber-800' : 'text-slate-600'
              }`}
            >
              {item.statusRotulo}
            </span>
            {item.categoriaOuEspecialidade && (
              <>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-slate-500 font-medium">{item.categoriaOuEspecialidade}</span>
              </>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {item.titulo}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{item.subtitulo}</span>
          </div>
        </div>

        {/* Bloco de Data e Horário em Destaque */}
        <div className="sm:text-right shrink-0 flex items-center sm:items-end justify-between sm:justify-start gap-2">
          {item.possuiDataDefinida && item.dataHora ? (
            <div className="inline-flex sm:flex-col items-center sm:items-end gap-1.5 bg-slate-50 border border-slate-200/90 px-3 py-1.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{item.dataExibicao || item.dataHora.split('T')[0]}</span>
              </div>
              {item.dataHora.includes('T') && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 font-mono">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{item.horarioExibicao || item.dataHora.split('T')[1].slice(0, 5)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-amber-100/90 text-amber-950 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Data a Definir</span>
            </div>
          )}

          {/* Ações Rápidas (Desktop / Topo) */}
          <div className="flex items-center gap-0.5 sm:ml-2">
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Editar agendamento"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Excluir agendamento"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Caixa de Alerta Amarelo com Motivo da Pendência */}
      {isPendente && item.motivoAlerta && (
        <div className="mt-3 p-3 bg-amber-100/80 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Aguardando definição:</span>
            <p className="leading-relaxed font-medium text-amber-900">
              {item.motivoAlerta}
            </p>
          </div>
        </div>
      )}

      {/* Detalhes Complementares (Motivo / Observações) */}
      {(item.motivo || item.observacoes) && (
        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
          {item.motivo && (
            <p className="line-clamp-2">
              <strong className="text-slate-700">Motivo:</strong> {item.motivo}
            </p>
          )}
          {item.observacoes && (
            <p className="line-clamp-2 italic text-slate-500">
              <strong className="text-slate-600 not-italic">Obs:</strong> {item.observacoes}
            </p>
          )}
        </div>
      )}

      {/* Rodapé com Local, Documento Vinculado e Botão Avisar Família */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          {item.local && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[220px]">{item.local}</span>
            </div>
          )}

          {item.nomeDocumento && (
            <button
              onClick={() => onViewDocument && item.documentoId && onViewDocument(item.documentoId)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 transition-colors truncate max-w-[240px]"
              title="Visualizar laudo ou documento vinculado"
            >
              <FileCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{item.nomeDocumento}</span>
              <ArrowUpRight className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>

        {/* Botão Acessível de Avisar Família (Web Share API) */}
        <button
          onClick={() => onShare(item)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors shadow-2xs min-h-[36px]"
          title="Compartilhar ou avisar a família via WhatsApp/SMS"
        >
          <Share2 className="w-3.5 h-3.5 text-blue-600" />
          <span>Avisar Família</span>
        </button>
      </div>
    </article>
  );
};
