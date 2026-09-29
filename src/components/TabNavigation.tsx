import React, { useState } from 'react';
import { usePatient, NavigationTab } from '../context/PatientContext';
import {
  LayoutDashboard,
  Pill,
  CalendarCheck2,
  Activity,
  FileText,
  Clock,
  History,
  MoreHorizontal,
  X,
  ChevronRight,
} from 'lucide-react';

interface TabItem {
  id: NavigationTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DESKTOP_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Início', icon: LayoutDashboard },
  { id: 'medicamentos', label: 'Medicamentos', shortLabel: 'Remédios', icon: Pill },
  { id: 'consultas', label: 'Consultas', shortLabel: 'Consultas', icon: CalendarCheck2 },
  { id: 'exames', label: 'Exames', shortLabel: 'Exames', icon: Activity },
  { id: 'documentos', label: 'Documentos', shortLabel: 'Documentos', icon: FileText },
  { id: 'linha_tempo', label: 'Linha do Tempo', shortLabel: 'Linha', icon: Clock },
  { id: 'historico', label: 'Histórico', shortLabel: 'Histórico', icon: History },
];

const MOBILE_PRIMARY_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Início', shortLabel: 'Início', icon: LayoutDashboard },
  { id: 'medicamentos', label: 'Medicamentos', shortLabel: 'Remédios', icon: Pill },
  { id: 'consultas', label: 'Consultas', shortLabel: 'Consultas', icon: CalendarCheck2 },
  { id: 'exames', label: 'Exames', shortLabel: 'Exames', icon: Activity },
  { id: 'documentos', label: 'Documentos', shortLabel: 'Docs', icon: FileText },
];

export const TabNavigation: React.FC = () => {
  const { activeTab, setActiveTab } = usePatient();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const isMoreActive = activeTab === 'linha_tempo' || activeTab === 'historico';

  return (
    <>
      {/* Desktop & Tablet Top Navigation Bar */}
      <nav
        id="desktop-navigation-tabs"
        className="hidden md:block bg-white border-b border-slate-200/90 sticky top-16 sm:top-20 z-30 shadow-xs"
        aria-label="Navegação Principal"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5">
            {DESKTOP_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-desktop-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Drawer for Extra Tabs (Linha do Tempo, Histórico) */}
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="flex-1"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="bg-white rounded-t-3xl p-5 border-t border-slate-200 shadow-2xl space-y-3 pb-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Mais Recursos</h3>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('linha_tempo');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left border transition-all ${
                  activeTab === 'linha_tempo'
                    ? 'bg-blue-50 border-blue-200 text-blue-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-800 font-semibold hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Linha do Tempo Clínica</p>
                    <p className="text-xs text-slate-500">Histórico cronológico de eventos e prescrições</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('historico');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left border transition-all ${
                  activeTab === 'historico'
                    ? 'bg-blue-50 border-blue-200 text-blue-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-800 font-semibold hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Histórico de Alterações</p>
                    <p className="text-xs text-slate-500">Log de auditoria e ações realizadas na família</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Fixed Navigation Bar (Thumb-optimized, 48px+ targets) */}
      <nav
        id="mobile-bottom-navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl px-1.5 pt-1 pb-[max(env(safe-area-inset-bottom),8px)]"
        aria-label="Navegação Inferior Mobile"
      >
        <div className="grid grid-cols-6 gap-1 max-w-lg mx-auto">
          {MOBILE_PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-mobile-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMoreMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[52px] select-none active:scale-[0.96] ${
                  isActive
                    ? 'text-blue-700 bg-blue-50/90 font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={`w-5 h-5 mb-0.5 transition-transform ${
                    isActive ? 'text-blue-600 stroke-[2.5] scale-110' : 'text-slate-500 stroke-2'
                  }`}
                />
                <span className={`text-[11px] leading-tight truncate max-w-full tracking-tight ${
                  isActive ? 'text-blue-700 font-bold' : 'text-slate-700'
                }`}>
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}

          {/* 6th Slot: Mais */}
          <button
            id="tab-mobile-more"
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[52px] select-none active:scale-[0.96] ${
              isMoreActive || isMoreMenuOpen
                ? 'text-blue-700 bg-blue-50/90 font-bold'
                : 'text-slate-600 hover:text-slate-900 font-semibold'
            }`}
            aria-expanded={isMoreMenuOpen}
          >
            <MoreHorizontal
              className={`w-5 h-5 mb-0.5 ${
                isMoreActive || isMoreMenuOpen
                  ? 'text-blue-600 stroke-[2.5] scale-110'
                  : 'text-slate-500 stroke-2'
              }`}
            />
            <span className={`text-[11px] leading-tight truncate max-w-full tracking-tight ${
              isMoreActive || isMoreMenuOpen ? 'text-blue-700 font-bold' : 'text-slate-700'
            }`}>
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
