import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  Loader2,
  LogOut,
  CheckCircle2,
  Info,
  Building2,
  RefreshCw,
  AlertCircle,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { User, AccessRequest } from '../types';
import { api, ApiError } from '../services/api';

interface FamilyOnboardingViewProps {
  user: User | null;
  onFamilyCreated: () => Promise<void>;
  onRefreshMemberships: () => Promise<void>;
  onLogout: () => Promise<void>;
}

type OnboardingStep = 'choice' | 'create_family' | 'request_access';

export const FamilyOnboardingView: React.FC<FamilyOnboardingViewProps> = ({
  user,
  onFamilyCreated,
  onRefreshMemberships,
  onLogout,
}) => {
  const [step, setStep] = useState<OnboardingStep>('choice');
  const [familyName, setFamilyName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accessLookupMessage, setAccessLookupMessage] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Carrega solicitações anteriores do usuário
  const fetchMyRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const reqs = await api.getMyAccessRequests();
      setMyRequests(reqs || []);
    } catch (err) {
      console.warn('Erro ao carregar solicitações do usuário:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (step === 'request_access') {
      fetchMyRequests();
    }
  }, [step]);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) {
      setErrorMessage('Por favor, informe o nome da sua família.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setAccessLookupMessage(null);
      const res = await api.createFamily({ name: familyName.trim() });
      if (res?.family?.id) {
        api.setActiveFamilyId(res.family.id);
      }
      await onFamilyCreated();
    } catch (err: any) {
      console.error('Erro ao criar família:', err);
      setErrorMessage(err.message || 'Erro ao criar família. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = ownerEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Por favor, informe o e-mail do responsável pela família.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await api.requestAccess({ ownerEmail: cleanEmail });
      setSuccessMessage(res.message || 'Solicitação enviada com sucesso!');
      setOwnerEmail('');
      await fetchMyRequests();
    } catch (err: any) {
      console.error('Erro ao solicitar acesso:', err);
      setErrorMessage(err.message || 'Não foi possível enviar a solicitação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccessMyFamily = async () => {
    try {
      setIsCheckingAccess(true);
      setErrorMessage(null);
      setAccessLookupMessage(null);

      // Re-query backend memberships for the authenticated user
      const meResponse = await api.getCurrentUser();

      if (meResponse?.membership && meResponse?.family && meResponse.membership.status === 'active') {
        // Active membership found! Enter application
        await onRefreshMemberships();
      } else if (meResponse?.membership && meResponse.membership.status === 'pending') {
        setAccessLookupMessage('Seu vínculo familiar foi encontrado, porém ainda está pendente de aprovação.');
        await onRefreshMemberships();
      } else if (meResponse?.membership && meResponse.membership.status === 'disabled') {
        setAccessLookupMessage('Seu vínculo familiar foi encontrado, porém o acesso está desativado.');
        await onRefreshMemberships();
      } else {
        // No membership found
        setAccessLookupMessage('Não encontramos uma família vinculada a esta conta.');
      }
    } catch (err: any) {
      console.error('Erro ao verificar memberships:', err);
      if (err instanceof ApiError && err.status === 403) {
        if (err.code === 'MEMBERSHIP_PENDING') {
          setAccessLookupMessage('Seu acesso à família está pendente de aprovação pelo administrador.');
        } else if (err.code === 'MEMBERSHIP_DISABLED') {
          setAccessLookupMessage('Seu acesso à família foi desativado pelo administrador.');
        } else {
          setAccessLookupMessage('Não encontramos uma família vinculada a esta conta.');
        }
      } else {
        setAccessLookupMessage('Não encontramos uma família vinculada a esta conta.');
      }
    } finally {
      setIsCheckingAccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header gradient bar */}
        <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />

        <div className="p-6 sm:p-8">
          {/* Brand header */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <span className="text-sm tracking-wider font-extrabold">SF</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Saúde Familiar</h1>
                <p className="text-xs text-slate-500">Bem-vindo(a), {user?.name || 'ao sistema'}</p>
              </div>
            </div>
            <button
              type="button"
              id="btn-onboarding-logout"
              onClick={onLogout}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
              title="Sair da conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>

          {/* Step 1: Choice */}
          {step === 'choice' && (
            <div className="mt-6 space-y-6">
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-bold text-slate-900">Como deseja começar?</h2>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Para gerenciar medicamentos, consultas e prontuários com segurança, organize seu espaço familiar ou solicite acesso à família de um familiar.
                </p>
              </div>

              {/* Account alert message when no family is found upon clicking "Acessar minha família" */}
              {accessLookupMessage && (
                <div
                  id="access-lookup-alert"
                  className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2.5 animate-fadeIn"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">{accessLookupMessage}</p>
                      <p className="text-amber-800/80 mt-0.5 leading-relaxed">
                        Verifique se você utilizou a conta Google correta vinculada pelo administrador da sua família.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                    <span className="text-[11px] text-amber-700 truncate max-w-[200px]">
                      Conectado como: <strong>{user?.email}</strong>
                    </span>
                    <button
                      type="button"
                      id="btn-switch-account"
                      onClick={onLogout}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      <LogOut className="w-3 h-3" />
                      Trocar de conta
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {/* Option 1: Create Family */}
                <button
                  type="button"
                  id="btn-create-my-family"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setAccessLookupMessage(null);
                    setStep('create_family');
                  }}
                  className="w-full text-left p-4 rounded-xl border-2 border-blue-600/20 hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50 transition group flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <PlusCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                        Criar minha família
                      </span>
                      <span className="block text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Crie seu próprio grupo familiar para cadastrar prontuários e convidar outros cuidadores.
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-blue-600 shrink-0 self-center opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Option 2: Request Access */}
                <button
                  type="button"
                  id="btn-request-family-access"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setAccessLookupMessage(null);
                    setStep('request_access');
                  }}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition group flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0 group-hover:scale-105 transition-transform">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-base font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
                        Solicitar acesso a uma família existente
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Informe o e-mail do responsável para pedir acesso a um paciente ou familiar.
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 shrink-0 self-center opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Option 3: Already part of a family */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-200 text-slate-800 shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <span className="block text-base font-semibold text-slate-900">
                        Já faço parte de uma família
                      </span>
                      <span className="block text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Verifique novamente se esta conta já possui vínculo aprovado com uma família.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                    <button
                      type="button"
                      id="btn-access-my-family"
                      onClick={handleAccessMyFamily}
                      disabled={isCheckingAccess}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50"
                    >
                      {isCheckingAccess ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verificando vínculo...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Acessar minha família</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      id="btn-switch-account-alt"
                      onClick={onLogout}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                      title="Entrar com outro e-mail Google"
                    >
                      <LogOut className="w-3 h-3 text-slate-500" />
                      <span>Trocar de conta</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Create Family Form */}
          {step === 'create_family' && (
            <form onSubmit={handleCreateFamily} className="mt-6 space-y-5">
              <button
                type="button"
                onClick={() => setStep('choice')}
                disabled={isSubmitting}
                className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition -mt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Voltar às opções
              </button>

              <div>
                <h2 className="text-xl font-bold text-slate-900">Criar minha família</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Defina um nome de identificação para o seu grupo familiar.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome da Família *
                </label>
                <input
                  type="text"
                  required
                  id="family-name-input"
                  placeholder="Ex: Família Silva, Família Santos"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white text-slate-900 transition"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Você será registrado como Administrador (Owner) desta família e poderá gerenciar todos os prontuários.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="btn-submit-create-family"
                  disabled={isSubmitting || !familyName.trim()}
                  className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando família e configurando acesso...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Criar Família e Entrar
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Request Access Flow */}
          {step === 'request_access' && (
            <div className="mt-6 space-y-5">
              <button
                type="button"
                onClick={() => setStep('choice')}
                disabled={isSubmitting}
                className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition -mt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Voltar às opções
              </button>

              <div>
                <h2 className="text-xl font-bold text-slate-900">Solicitar acesso a uma família</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Informe o e-mail do responsável pela família para solicitar acesso ao paciente.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-900">{successMessage}</p>
                    <p className="text-emerald-700">
                      O responsável receberá seu pedido e poderá liberar o paciente e seu perfil de acesso.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleRequestAccess} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    E-mail do Responsável (Owner) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      id="owner-email-input"
                      placeholder="ex: paulo.feitosa@gmail.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white text-slate-900 transition"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Por privacidade, não listamos famílias publicamente. O responsável escolherá o paciente e o papel.
                    </span>
                  </p>
                </div>

                <button
                  type="submit"
                  id="btn-submit-request-access"
                  disabled={isSubmitting || !ownerEmail.trim()}
                  className="w-full flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition disabled:opacity-50 text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando solicitação...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Solicitação de Acesso
                    </>
                  )}
                </button>
              </form>

              {/* Status das minhas solicitações */}
              {myRequests.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Suas Solicitações
                    </h3>
                    <button
                      type="button"
                      onClick={fetchMyRequests}
                      disabled={isLoadingRequests}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingRequests ? 'animate-spin' : ''}`} />
                      Atualizar
                    </button>
                  </div>

                  <div className="space-y-2">
                    {myRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">
                            {req.familyName || 'Família'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Solicitado em {new Date(req.requestedAt).toLocaleDateString('pt-BR')}
                            {req.patientName ? ` • Paciente: ${req.patientName}` : ''}
                          </p>
                        </div>
                        <div>
                          {req.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium text-[11px]">
                              <Clock className="w-3 h-3" />
                              Pendente
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium text-[11px]">
                              <CheckCircle className="w-3 h-3" />
                              Aprovado
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium text-[11px]">
                              <XCircle className="w-3 h-3" />
                              Recusado
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {myRequests.some((r) => r.status === 'approved') && (
                    <button
                      type="button"
                      onClick={handleAccessMyFamily}
                      className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition"
                    >
                      Acessar Família Aprovada Agora
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


