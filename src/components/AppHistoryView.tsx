import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Download,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
  ServerOff,
  Cpu,
  Smartphone,
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { exportService } from '../services/exportService';
import { DeleteAllDataModal } from './DeleteAllDataModal';

interface ChangelogVersion {
  version: string;
  releaseDate: string;
  isCurrent?: boolean;
  tagline: string;
  added: string[];
  removed: string[];
  changed: string[];
}

const CHANGELOG_DATA: ChangelogVersion[] = [
  {
    version: 'v1.3.0',
    releaseDate: '28 de Setembro de 2026',
    isCurrent: true,
    tagline: 'Leitura de Receitas com IA em Memória (Zero Storage), Backup e Histórico de Versões',
    added: [
      'Leitura inteligente de receitas médicas via IA (OCR multimodal em memória com Google Gemini 3.8 Flash).',
      'Suporte a fotos tiradas direto da câmera do smartphone e upload de arquivos PDF e imagens (JPEG, PNG, WEBP).',
      'Interface de Revisão Humana para validação, edição de remédios, dosagens, frequências e horários antes do registro definitivo.',
      'Aba dedicada "Histórico" com o registro detalhado de versões do aplicativo (Adicionado, Excluído e Alterado).',
      'Ferramenta completa de Exportação e Backup dos dados em planilhas estruturadas (.xlsx).',
      'Funcionalidade de "Apagar Todos os Dados" com pergunta obrigatória sobre backup prévio e trava de segurança por confirmação textual.',
    ],
    removed: [
      'Excluído qualquer armazenamento e hospedagem de arquivos brutos (Google Cloud Storage / buckets), garantindo custo zero de infraestrutura e privacidade absoluta dos dados médicos.',
      'Removidos formulários legados de upload estático de documentos sem leitura inteligente.',
      'Removidos mocks residuais em favor do repositório autoritativo Cloud Firestore com regras de segurança RBAC.',
    ],
    changed: [
      'A única finalidade de envio de arquivos no aplicativo agora é exclusivamente para leitura e transcrição inteligente, com descarte imediato da memória volátil (RAM) após o processamento.',
      'Aprimoramento das instruções de sistema da IA para fidelidade estrita aos nomes originais dos medicamentos e detecção de caligrafia médica ilegível.',
      'Otimização do tratamento de permissões IAM do Firestore sem degradações silenciosas.',
      'Ajustes nos menus de navegação superior e inferior (mobile) com atalhos rápidos para as novas funcionalidades.',
    ],
  },
  {
    version: 'v1.2.0',
    releaseDate: '15 de Setembro de 2026',
    tagline: 'Controle de Acessos Familiares (RBAC), Convites por Link e Segurança de Contas',
    added: [
      'Sistema de convites com link seguro e token temporário para familiares e cuidadores.',
      'Controle de papéis e permissões (Administrador/Owner, Cuidador e Visualizador).',
      'Tela de gerenciamento de solicitações de acesso e membros da família.',
      'Modal de segurança da conta com suporte a autenticação multifator (MFA TOTP) e alteração de senha.',
    ],
    removed: [
      'Removido acesso anônimo não verificado para áreas com dados clínicos sensíveis.',
    ],
    changed: [
      'Centralização das regras de autorização no backend e validação estrita por paciente.',
      'Ajustes no fluxo de onboarding para criação de nova família ou vínculo a uma família existente.',
    ],
  },
  {
    version: 'v1.1.0',
    releaseDate: '01 de Setembro de 2026',
    tagline: 'Módulos Clínicos: Consultas, Exames Laboratoriais e Linha do Tempo',
    added: [
      'Módulo de Consultas Médicas com acompanhamento de datas, especialidades e orientações pós-consulta.',
      'Módulo de Exames Laboratoriais e de Imagem com controle de status (solicitado, agendado, realizado).',
      'Linha do Tempo Clínica integrada para visualização cronológica de todos os eventos de saúde.',
      'Ficha de Emergência com contatos rápidos e chamada telefônica direta em um clique.',
    ],
    removed: [
      'Removidos campos redundantes de histórico manual.',
    ],
    changed: [
      'Dashboard aprimorado com card em destaque para o próximo remédio do dia e registro rápido de tomada de dose.',
    ],
  },
  {
    version: 'v1.0.0',
    releaseDate: '15 de Agosto de 2026',
    tagline: 'Lançamento Inicial da Plataforma Saúde Familiar',
    added: [
      'Cadastro de múltiplos pacientes/familiares.',
      'Gestão de medicamentos de uso contínuo e tratamentos pontuais com horários e dosagens.',
      'Ficha médica com tipo sanguíneo, alergias e informações do médico responsável.',
      'Autenticação segura via Firebase Auth.',
    ],
    removed: [],
    changed: [],
  },
];

export const AppHistoryView: React.FC = () => {
  const { patients, showToast, refreshPatients } = usePatient();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleQuickBackup = async () => {
    if (patients.length === 0) {
      showToast('Não há pacientes cadastrados para exportar backup.', 'info');
      return;
    }
    try {
      setIsExporting(true);
      await exportService.exportUserData(patients);
      showToast('Backup baixado com sucesso em planilha (.xlsx)!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao gerar backup.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl border border-blue-100 shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Histórico de Versões do Aplicativo
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                v1.3.0 (Atual)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Registro completo de atualizações: o que foi adicionado, excluído e alterado no Saúde Familiar.
            </p>
          </div>
        </div>

        {/* Quick Data Management Actions in Header */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="history-btn-download-backup"
            onClick={handleQuickBackup}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isExporting ? 'Baixando...' : 'Baixar Backup (.xlsx)'}</span>
          </button>
          <button
            type="button"
            id="history-btn-wipe-data"
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Apagar Dados...</span>
          </button>
        </div>
      </div>

      {/* Zero Storage Architecture Guarantee Banner */}
      <div className="p-4 bg-linear-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3 text-xs text-slate-700">
          <ServerOff className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900">
              Arquitetura de Custo Zero & Máxima Privacidade (Zero Storage):
            </span>
            <p className="text-slate-600">
              O Saúde Familiar não armazena nem hospeda arquivos binários de exames ou receitas em servidores.
              Qualquer arquivo ou foto enviado é processado estritamente em memória volátil pela IA para leitura textual e imediatamente descartado.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs">
            <Cpu className="w-3 h-3 text-indigo-600" />
            Gemini 3.8 Flash
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs">
            <Smartphone className="w-3 h-3 text-emerald-600" />
            Câmera & PDF
          </span>
        </div>
      </div>

      {/* Changelog Timeline of Versions */}
      <div className="space-y-6">
        {CHANGELOG_DATA.map((entry) => (
          <div
            key={entry.version}
            className={`bg-white rounded-2xl border p-5 sm:p-6 transition-all ${
              entry.isCurrent
                ? 'border-blue-300 ring-2 ring-blue-500/10 shadow-sm'
                : 'border-slate-200 shadow-2xs opacity-95'
            }`}
          >
            {/* Version Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-base sm:text-lg font-black font-mono px-3 py-1 rounded-lg ${
                    entry.isCurrent
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {entry.version}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{entry.tagline}</span>
                    {entry.isCurrent && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Versão Vigente
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{entry.releaseDate}</span>
                </div>
              </div>
            </div>

            {/* Categorized Changes Grid: Adicionado, Excluído, Alterado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Adicionado */}
              <div className="bg-emerald-50/50 rounded-xl p-3.5 sm:p-4 border border-emerald-200/70 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>Adicionado ({entry.added.length})</span>
                </div>
                {entry.added.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {entry.added.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhum item adicionado.</p>
                )}
              </div>

              {/* Excluído */}
              <div className="bg-rose-50/50 rounded-xl p-3.5 sm:p-4 border border-rose-200/70 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wider">
                  <MinusCircle className="w-4 h-4 text-rose-600" />
                  <span>Excluído ({entry.removed.length})</span>
                </div>
                {entry.removed.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {entry.removed.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhum item excluído.</p>
                )}
              </div>

              {/* Alterado */}
              <div className="bg-amber-50/50 rounded-xl p-3.5 sm:p-4 border border-amber-200/70 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                  <span>Alterado ({entry.changed.length})</span>
                </div>
                {entry.changed.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {entry.changed.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhum item alterado.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Data Management & Backup Full Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Gerenciamento e Proteção dos Dados Familiares
              </h3>
              <p className="text-xs text-slate-500">
                Garantia de portabilidade de dados e exclusão segura a qualquer momento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickBackup}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 shadow-2xs transition-colors"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>{isExporting ? 'Gerando Backup...' : 'Baixar Cópia (.xlsx)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-2xs transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Apagar Todos os Dados</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete All Data Safety Modal */}
      <DeleteAllDataModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDataWiped={() => {
          refreshPatients();
        }}
      />
    </div>
  );
};
