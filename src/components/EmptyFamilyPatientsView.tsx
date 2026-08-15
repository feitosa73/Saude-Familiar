import React from 'react';
import { Users, UserPlus, HeartPulse, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EmptyFamilyPatientsViewProps {
  onOpenNewPatient: () => void;
}

export const EmptyFamilyPatientsView: React.FC<EmptyFamilyPatientsViewProps> = ({
  onOpenNewPatient,
}) => {
  const { family, membership } = useAuth();
  const isOwner = membership?.role === 'owner';

  return (
    <div
      id="empty-family-patients-view"
      className="max-w-2xl mx-auto my-8 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
    >
      {/* Decorative Top Accent */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 to-teal-500" />

      <div className="p-8 sm:p-10 text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto mb-5 shadow-xs">
          <Users className="w-8 h-8" />
        </div>

        {/* Family Badge */}
        {family && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold mb-3 border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Espaço Familiar: {family.name}</span>
          </div>
        )}

        {/* Title and descriptions */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Nenhum familiar cadastrado ainda.
        </h2>
        <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-lg mx-auto leading-relaxed">
          Cadastre o primeiro familiar para começar a organizar os dados de saúde, medicamentos, consultas, exames e documentos médicos.
        </p>

        {/* Action Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            id="btn-empty-state-add-patient"
            onClick={onOpenNewPatient}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition"
          >
            <UserPlus className="w-5 h-5" />
            <span>+ Cadastrar Familiar</span>
          </button>
        </div>

        {/* Helpful bullet hints */}
        <div className="mt-10 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-800 block mb-1">Medicamentos & Doses</span>
            <span className="text-[11px] text-slate-500 leading-tight block">
              Horários, posologia contínua e controle diário de administração.
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-800 block mb-1">Consultas & Exames</span>
            <span className="text-[11px] text-slate-500 leading-tight block">
              Agendamentos, orientações pós-consulta e histórico de resultados.
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-800 block mb-1">Prontuário Seguro</span>
            <span className="text-[11px] text-slate-500 leading-tight block">
              Acesso compartilhado com outros familiares e cuidadores com RBAC.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
