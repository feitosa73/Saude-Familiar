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
  Users,
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
  { id: 'agenda', label: 'Consultas e Exames', shortLabel: 'Agenda', icon: CalendarCheck2 },
  { id: 'documentos', label: 'Documentos', shortLabel: 'Documentos', icon: FileText },
  { id: 'pessoas', label: 'Cuidadores e Familiares', shortLabel: 'Pessoas', icon: Users },
  { id: 'linha_tempo', label: 'Linha do Tempo', shortLabel: 'Linha', icon: Clock },
  { id: 'historico', label: 'Histórico', shortLabel: 'Histórico', icon: History },
];

const MOBILE_PRIMARY_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Início', shortLabel: 'Início', icon: LayoutDashboard },
  { id: 'medicamentos', label: 'Medicamentos', shortLabel: 'Remédios', icon: Pill },
  { id: 'agenda', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarCheck2 },
  { id: 'pessoas', label: 'Pessoas', shortLabel: 'Pessoas', icon: Users },
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
        className="hidden md:block bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 sticky top-16 sm:top-20 z-30 shadow-xs transition-colors"
        aria-label="Navegação Principal"
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
          <div className="flex space-x-1.5 sm:space-x-2.5 overflow-x-auto py-3">
            {DESKTOP_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-desktop-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl text-sm sm:text-base font-bold whitespace-nowrap transition-all min-h-[44px] cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Drawer for Extra Tabs (Linha do Tempo, Histórico) */}
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div
            className="flex-1"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl p-5 border-t border-slate-200 dark:border-slate-800 shadow-2xl space-y-3 pb-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Mais Recursos</h3>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                  activeTab === 'linha_tempo'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Linha do Tempo Clínica</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Histórico cronológico de eventos e prescrições</p>
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
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                  activeTab === 'historico'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Histórico de Alterações</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Log de auditoria e ações realizadas na família</p>
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-2xl px-1.5 pt-1 pb-[max(env(safe-area-inset-bottom),8px)] transition-colors"
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
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[54px] select-none active:scale-[0.96] cursor-pointer ${
                  isActive
                    ? 'text-blue-700 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/50 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={`w-5 h-5 mb-0.5 transition-transform ${
                    isActive ? 'text-blue-600 dark:text-blue-400 stroke-[2.5] scale-110' : 'text-slate-500 dark:text-slate-400 stroke-2'
                  }`}
                />
                <span className={`text-xs leading-tight truncate max-w-full tracking-tight ${
                  isActive ? 'text-blue-700 dark:text-blue-400 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-semibold'
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
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[54px] select-none active:scale-[0.96] cursor-pointer ${
              isMoreActive || isMoreMenuOpen
                ? 'text-blue-700 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/50 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold'
            }`}
            aria-expanded={isMoreMenuOpen}
          >
            <MoreHorizontal
              className={`w-5 h-5 mb-0.5 ${
                isMoreActive || isMoreMenuOpen
                  ? 'text-blue-600 dark:text-blue-400 stroke-[2.5] scale-110'
                  : 'text-slate-500 dark:text-slate-400 stroke-2'
              }`}
            />
            <span className={`text-xs leading-tight truncate max-w-full tracking-tight ${
              isMoreActive || isMoreMenuOpen ? 'text-blue-700 dark:text-blue-400 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-semibold'
            }`}>
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
