import React from 'react';
import { usePatient, NavigationTab } from '../context/PatientContext';
import {
  LayoutDashboard,
  Pill,
  CalendarCheck2,
  Activity,
  FileText,
  History,
} from 'lucide-react';

interface TabItem {
  id: NavigationTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Início', icon: LayoutDashboard },
  { id: 'medicamentos', label: 'Medicamentos', shortLabel: 'Remédios', icon: Pill },
  { id: 'consultas', label: 'Consultas', shortLabel: 'Consultas', icon: CalendarCheck2 },
  { id: 'exames', label: 'Exames', shortLabel: 'Exames', icon: Activity },
  { id: 'documentos', label: 'Documentos', shortLabel: 'Docs', icon: FileText },
  { id: 'linha_tempo', label: 'Linha do Tempo', shortLabel: 'Histórico', icon: History },
];

export const TabNavigation: React.FC = () => {
  const { activeTab, setActiveTab } = usePatient();

  return (
    <>
      {/* Desktop & Tablet Top Navigation Bar */}
      <nav
        id="desktop-navigation-tabs"
        className="hidden md:block bg-white border-b border-slate-200 sticky top-16 sm:top-20 z-30 shadow-xs"
        aria-label="Navegação Principal"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-desktop-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Sticky Navigation Bar */}
      <nav
        id="mobile-bottom-navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-1 py-1 shadow-lg"
        aria-label="Navegação Mobile"
      >
        <div className="grid grid-cols-6 gap-0.5 max-w-lg mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-mobile-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all min-h-[54px] ${
                  isActive
                    ? 'text-blue-700 bg-blue-50 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={`w-5 h-5 mb-1 ${
                    isActive ? 'text-blue-600 stroke-[2.5]' : 'text-slate-400 stroke-2'
                  }`}
                />
                <span className="text-[10px] leading-tight truncate max-w-full">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
