import React, { useState } from 'react';
import { ShieldAlert, Clock, Ban, RefreshCw, LogOut, Copy, Check, UserCheck } from 'lucide-react';
import { AuthAccessStatus } from '../context/AuthContext';
import { User, FamilyMembership, Family } from '../types';

interface AccessDeniedViewProps {
  status: AuthAccessStatus;
  user: User | null;
  family: Family | null;
  membership: FamilyMembership | null;
  statusMessage: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  status,
  user,
  family,
  membership,
  statusMessage,
  onRefresh,
  onLogout,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyUid = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-12 h-12 text-amber-500" />,
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
          badgeText: 'Acesso Pendente',
          title: 'Aguardando Aprovação de Acesso',
          description:
            'Sua solicitação de acesso para esta família foi registrada e está aguardando aprovação pelo Administrador (Owner).',
          hint: 'Assim que o administrador aprovar sua conta, clique em "Verificar Novamente" para acessar o painel.',
        };
      case 'disabled':
        return {
          icon: <Ban className="w-12 h-12 text-red-500" />,
          badgeColor: 'bg-red-100 text-red-800 border-red-200',
          badgeText: 'Acesso Desativado',
          title: 'Acesso à Família Desativado',
          description:
            'O seu acesso à família foi desativado temporariamente pelo Administrador.',
          hint: 'Entre em contato com o responsável pela conta familiar para restabelecer seu acesso.',
        };
      case 'firestore_not_initialized':
        return {
          icon: <ShieldAlert className="w-12 h-12 text-amber-500" />,
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
          badgeText: 'Banco de Dados Não Provisionado',
          title: 'Banco Firestore ainda não provisionado',
          description:
            statusMessage ||
            'A API Cloud Firestore não está habilitada ou o banco de dados ainda não foi provisionado no projeto GCP (prj-saudefamiliar-pessoal-pfl).',
          hint: 'Execute o provisionamento da infraestrutura no repositório feitosa73/saude-familiar-infra. Após a conclusão, execute o bootstrap e clique em "Verificar Novamente".',
        };
      case 'error':
        return {
          icon: <ShieldAlert className="w-12 h-12 text-red-500" />,
          badgeColor: 'bg-red-100 text-red-800 border-red-200',
          badgeText: 'Erro de Autorização',
          title: 'Falha na Validação de Acesso',
          description:
            statusMessage ||
            'Não foi possível validar suas permissões com o servidor de autenticação.',
          hint: 'Verifique sua conexão e tente novamente em instantes.',
        };
      case 'no_membership':
      default:
        return {
          icon: <UserCheck className="w-12 h-12 text-blue-600" />,
          badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
          badgeText: 'Sem Vínculo Familiar',
          title: 'Conta Autenticada, Sem Família Vinculada',
          description:
            'Sua identidade Google foi autenticada pelo Firebase Auth com sucesso, porém o sistema não localizou uma membresia ativa para o seu usuário.',
          hint: 'Para ter acesso aos prontuários e pacientes, envie seu Firebase UID abaixo para o Administrador da Família para ser incluído.',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header decoration bar */}
        <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />

        <div className="p-8">
          {/* Icon and status badge */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-3">
              {config.icon}
            </div>
            <span
              className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${config.badgeColor} mb-2`}
            >
              {config.badgeText}
            </span>
            <h1 className="text-xl font-bold text-slate-800">{config.title}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{config.description}</p>
          </div>

          {/* User details card */}
          {user && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Usuário Autenticado:</span>
                <span className="text-xs font-semibold text-slate-800">{user.name}</span>
              </div>
              {user.email && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">E-mail:</span>
                  <span className="text-xs font-mono text-slate-700 truncate max-w-[200px]">
                    {user.email}
                  </span>
                </div>
              )}
              {family && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Família:</span>
                  <span className="text-xs font-semibold text-slate-800">{family.name}</span>
                </div>
              )}
              {membership && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Papel / Status:</span>
                  <span className="text-xs font-medium text-slate-700">
                    {membership.role} ({membership.status})
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">Firebase UID:</span>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700 font-medium"
                    title="Copiar UID"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span className="text-emerald-600">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs font-mono text-slate-600 bg-white p-2 rounded border border-slate-200 break-all select-all">
                  {user.id}
                </p>
              </div>
            </div>
          )}

          {/* Hint note */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-6">
            <p>{config.hint}</p>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Verificando autorização...' : 'Verificar Novamente'}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
