import React from 'react';
import {
  X,
  Pill,
  Activity,
  CalendarClock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

export type SelectedAiDocumentType = 'prescription' | 'exam_report' | 'schedule';

interface DocumentTypeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: SelectedAiDocumentType) => void;
  patientName?: string;
}

export const DocumentTypeSelectorModal: React.FC<DocumentTypeSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectType,
  patientName,
}) => {
  if (!isOpen) return null;

  const options = [
    {
      id: 'prescription' as SelectedAiDocumentType,
      title: 'Receita Médica',
      badge: 'Farmácia & Posologia',
      badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
      description: 'Prescrições de medicamentos de uso contínuo ou tratamento temporário.',
      details: 'Identifica nomes dos fármacos, concentrações, frequências e gera horários diários automáticos para o cuidador.',
      icon: <Pill className="w-6 h-6 text-blue-600" />,
      borderHover: 'hover:border-blue-400 hover:bg-blue-50/40',
      iconBg: 'bg-blue-100 text-blue-600',
      actionText: 'Escanear Receita',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    {
      id: 'exam_report' as SelectedAiDocumentType,
      title: 'Laudo de Exame Laboratorial / Imagem',
      badge: 'Analitos & Diagnóstico',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      description: 'Hemogramas, bioquímica de sangue, urina, raio-x, tomografia, ultrassom e ressonância.',
      details: 'Transcreve valores obtidos, limites de referência e gera um resumo explicativo dos resultados para o prontuário.',
      icon: <Activity className="w-6 h-6 text-emerald-600" />,
      borderHover: 'hover:border-emerald-400 hover:bg-emerald-50/40',
      iconBg: 'bg-emerald-100 text-emerald-600',
      actionText: 'Escanear Laudo',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      id: 'schedule' as SelectedAiDocumentType,
      title: 'Guia ou Comprovante de Agendamento',
      badge: 'Consultas & Exames Futuros',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      description: 'Comprovantes de marcação, pedidos, guias de autorização ou prints de confirmação via WhatsApp/SMS.',
      details: 'Reconhece especialidade, profissional, clínica, data/hora e instruções de preparo (como jejum) para a agenda.',
      icon: <CalendarClock className="w-6 h-6 text-purple-600" />,
      borderHover: 'hover:border-purple-400 hover:bg-purple-50/40',
      iconBg: 'bg-purple-100 text-purple-600',
      actionText: 'Escanear Agendamento',
      btnColor: 'bg-purple-600 hover:bg-purple-700 text-white',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-100 dark:sm:border-slate-800 overflow-hidden flex flex-col text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-linear-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 via-purple-500 to-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                O que você deseja ler com a IA?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {patientName ? `Paciente: ${patientName} • ` : ''}
                Selecione o tipo de documento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Options */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain pb-28 sm:pb-6">
          <div className="grid grid-cols-1 gap-3.5">
            {options.map((opt) => (
              <div
                key={opt.id}
                onClick={() => onSelectType(opt.id)}
                className={`group relative p-4 sm:p-5 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 cursor-pointer transition-all duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 ${opt.borderHover} hover:shadow-md`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${opt.iconBg} transition-transform group-hover:scale-105`}>
                    {opt.icon}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {opt.title}
                      </h3>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {opt.description}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {opt.details}
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-auto shrink-0 flex items-center justify-end sm:justify-start pt-2 sm:pt-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs group-hover:translate-x-0.5 ${opt.btnColor}`}>
                    <span>{opt.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy Note */}
          <div className="mt-5 p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 rounded-2xl flex items-start gap-2.5 text-sm text-blue-950 dark:text-blue-200">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-sm leading-relaxed">
              <span className="font-bold text-blue-900 dark:text-blue-300 block">Arquitetura Zero Storage & Privacidade LGPD</span>
              <p className="text-blue-900/90 dark:text-blue-200/90">
                Seus arquivos (PDF ou imagem) são analisados diretamente na memória RAM e descartados imediatamente após a extração estruturada. Nenhum arquivo original sensível fica gravado em servidores externos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
