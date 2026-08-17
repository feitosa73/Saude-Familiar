import { User, PatientAccess } from '../types';
import {
  auth,
  googleProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  MultiFactorResolver,
  updateProfile,
  signOut,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  isFirebaseConfigured,
  FirebaseUser,
  MultiFactorInfo,
} from '../lib/firebase';

export interface GoogleAuthCredentials {
  provider?: 'google';
}

export interface PasswordAuthCredentials {
  provider: 'password';
  email: string;
  password: string;
}

export type AuthCredentials = GoogleAuthCredentials | PasswordAuthCredentials;

export class MultiFactorAuthRequiredError extends Error {
  code = 'auth/multi-factor-auth-required';
  resolver: MultiFactorResolver;
  hints: any[];

  constructor(resolver: MultiFactorResolver) {
    super('Autenticação em duas etapas (MFA) necessária.');
    this.name = 'MultiFactorAuthRequiredError';
    this.resolver = resolver;
    this.hints = resolver.hints;
  }
}

export interface IAuthService {
  getCurrentUser(): User | null;
  getFirebaseUser(): FirebaseUser | null;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  login(credentials?: AuthCredentials): Promise<User>;
  resolveMfaSignIn(resolver: MultiFactorResolver, verificationCode: string): Promise<User>;
  register(name: string, email: string, password: string): Promise<User>;
  sendPasswordReset(email: string): Promise<void>;
  sendEmailVerification(): Promise<void>;
  reloadUser(): Promise<FirebaseUser | null>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  getEnrolledMfaFactors(): MultiFactorInfo[];
  startTotpMfaEnrollment(): Promise<{ secret: TotpSecret; qrCodeUrl: string; secretKey: string }>;
  finalizeTotpMfaEnrollment(secret: TotpSecret, verificationCode: string, displayName?: string): Promise<void>;
  unenrollMfa(factorUid: string, options?: string | { password?: string; useGoogle?: boolean }): Promise<void>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  getUserAccesses(userId: string): Promise<PatientAccess[]>;
}

const AUTH_STORAGE_KEY = 'saude_familiar_auth_user';
const ACCESS_STORAGE_KEY = 'saude_familiar_patient_accesses';

function formatFirebaseAuthError(error: any, defaultMessage: string): string {
  const code = error?.code || '';
  const msg = String(error?.message || '');

  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.';
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta associada a este e-mail. Faça login ou solicite a redefinição de senha.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Escolha uma senha com pelo menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas consecutivas sem sucesso. Por segurança, aguarde alguns instantes e tente novamente.';
    case 'auth/network-request-failed':
      return 'Falha de conexão com os servidores. Verifique sua conexão com a internet e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'A janela de login do Google foi fechada antes de concluir. Clique em "Continuar com Google" para tentar novamente.';
    case 'auth/cancelled-popup-request':
      return 'Tentativa de login anterior cancelada. Tente novamente.';
    case 'auth/popup-blocked':
      return 'A janela pop-up de login foi bloqueada pelo navegador. Permita pop-ups para este site para continuar.';
    case 'auth/unauthorized-domain': {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      return `Domínio não autorizado no Firebase Auth (${currentHost}). Adicione este domínio no Console do Firebase > Authentication > Settings > Authorized domains.`;
    }
    case 'auth/operation-not-allowed':
      return 'O provedor de autenticação não está habilitado no Firebase Console.';
    case 'auth/requires-recent-login':
      return 'Por segurança, faça login novamente antes de prosseguir com esta alteração.';
    case 'auth/invalid-verification-code':
      return 'Código do autenticador incorreto ou expirado. Digite o código atual de 6 dígitos gerado pelo seu app autenticador.';
    default:
      if (
        msg.toLowerCase().includes('database is closing') ||
        msg.toLowerCase().includes('hidden') ||
        msg.toLowerCase().includes('internal error') ||
        code === 'auth/internal-error'
      ) {
        return 'Não foi possível concluir a autenticação. Tente novamente em instantes.';
      }
      return defaultMessage;
  }
}

/**
 * Authentication Service (Integrated with Firebase Authentication)
 */
class AuthServiceImplementation implements IAuthService {
  private currentUser: User | null = null;
  private currentFirebaseUser: FirebaseUser | null = null;
  private listeners: ((user: User | null) => void)[] = [];
  private initPromise: Promise<FirebaseUser | null>;
  private isInitialized = false;

  constructor() {
    // Subscribe to Firebase Auth state if configured
    if (auth && isFirebaseConfigured) {
      this.initPromise = new Promise((resolve) => {
        let firstResolved = false;
        onFirebaseAuthStateChanged(auth, async (fbUser) => {
          this.currentFirebaseUser = fbUser;
          this.isInitialized = true;
          if (fbUser) {
            const user: User = {
              id: fbUser.uid,
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
              email: fbUser.email || '',
              avatarUrl: fbUser.photoURL || undefined,
              patientIds: [],
            };
            this.currentUser = user;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
          } else {
            this.currentUser = null;
            this.currentFirebaseUser = null;
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
          if (!firstResolved) {
            firstResolved = true;
            resolve(fbUser);
          }
          this.notifyListeners();
        });
      });
    } else {
      this.initPromise = Promise.resolve(null);
      this.isInitialized = true;
    }
  }

  async waitForInitialization(): Promise<FirebaseUser | null> {
    if (this.isInitialized) return this.currentFirebaseUser;
    return this.initPromise;
  }

  getFirebaseUser(): FirebaseUser | null {
    return auth?.currentUser || this.currentFirebaseUser;
  }

  getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser;
    if (auth?.currentUser) {
      const fbUser = auth.currentUser;
      return {
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
        email: fbUser.email || '',
        avatarUrl: fbUser.photoURL || undefined,
        patientIds: [],
      };
    }
    return null;
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (!this.isInitialized) {
      await this.waitForInitialization();
    }
    const fbUser = this.currentFirebaseUser || auth?.currentUser;
    if (fbUser && typeof fbUser.getIdToken === 'function') {
      try {
        const token = await fbUser.getIdToken(forceRefresh);
        if (token && typeof token === 'string' && token.trim().length > 20) {
          return token.trim();
        }
      } catch (error) {
        console.error('[Auth] Erro ao obter Firebase ID Token:', error);
      }
    }
    return null;
  }

  isAuthenticated(): boolean {
    return this.currentFirebaseUser !== null && this.currentUser !== null;
  }

  async login(credentials?: AuthCredentials): Promise<User> {
    if (!auth || !isFirebaseConfigured) {
      throw new Error('Firebase Authentication não está configurado neste ambiente.');
    }

    // 1. Email and Password Login
    if (credentials?.provider === 'password') {
      const trimmedEmail = credentials.email?.trim() || '';
      const password = credentials.password || '';

      if (!trimmedEmail) {
        throw new Error('Por favor, informe seu e-mail.');
      }
      if (!password) {
        throw new Error('Por favor, informe sua senha.');
      }

      try {
        const result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const fbUser = result.user;
        this.currentFirebaseUser = fbUser;
        const user: User = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
          email: fbUser.email || trimmedEmail,
          avatarUrl: fbUser.photoURL || undefined,
          patientIds: [],
        };
        this.currentUser = user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        this.notifyListeners();
        return user;
      } catch (error: any) {
        console.error('[Auth] Erro ao autenticar com e-mail e senha:', error);
        if (error?.code === 'auth/multi-factor-auth-required') {
          const resolver = getMultiFactorResolver(auth, error);
          throw new MultiFactorAuthRequiredError(resolver);
        }
        throw new Error(formatFirebaseAuthError(error, 'Não foi possível entrar. Verifique seu e-mail e senha.'));
      }
    }

    // 2. Google Sign-In with Firebase Auth
    if (credentials?.provider === 'google' || !credentials) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        this.currentFirebaseUser = fbUser;
        const user: User = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário Google',
          email: fbUser.email || '',
          avatarUrl: fbUser.photoURL || undefined,
          patientIds: [],
        };
        this.currentUser = user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        this.notifyListeners();
        return user;
      } catch (error: any) {
        console.error('[Auth] Erro durante o Google Sign-In via Firebase Auth:', error);
        if (error?.code === 'auth/multi-factor-auth-required') {
          const resolver = getMultiFactorResolver(auth, error);
          throw new MultiFactorAuthRequiredError(resolver);
        }
        throw new Error(formatFirebaseAuthError(error, 'Não foi possível concluir o login com Google. Tente novamente.'));
      }
    }

    throw new Error('Método de autenticação não suportado.');
  }

  async resolveMfaSignIn(resolver: MultiFactorResolver, verificationCode: string): Promise<User> {
    const totpHint = resolver.hints.find(
      (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
    );
    if (!totpHint) {
      throw new Error('Nenhum método de autenticação TOTP configurado para esta conta.');
    }
    const cleanCode = verificationCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      throw new Error('Informe o código de 6 dígitos gerado pelo seu aplicativo autenticador.');
    }
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpHint.uid,
        cleanCode
      );
      const userCredential = await resolver.resolveSignIn(assertion);
      const fbUser = userCredential.user;
      this.currentFirebaseUser = fbUser;
      const user: User = {
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
        email: fbUser.email || '',
        avatarUrl: fbUser.photoURL || undefined,
        patientIds: [],
      };
      this.currentUser = user;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      this.notifyListeners();
      return user;
    } catch (error: any) {
      console.error('[Auth] Erro ao resolver segundo fator:', error);
      if (error?.code === 'auth/invalid-verification-code') {
        throw new Error('Código do autenticador incorreto ou expirado. Digite o código atual exibido no app.');
      }
      throw new Error('Não foi possível verificar o código do autenticador. Tente novamente.');
    }
  }

  async register(name: string, email: string, password: string): Promise<User> {
    if (!auth || !isFirebaseConfigured) {
      throw new Error('Firebase Authentication não está configurado neste ambiente.');
    }

    const trimmedName = name?.trim() || '';
    const trimmedEmail = email?.trim() || '';

    if (!trimmedName) {
      throw new Error('Informe seu nome completo para criar a conta.');
    }
    if (!trimmedEmail) {
      throw new Error('Informe um e-mail válido para criar a conta.');
    }
    if (!password || password.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const fbUser = result.user;

      try {
        await updateProfile(fbUser, {
          displayName: trimmedName,
        });
      } catch (profileErr) {
        console.warn('[Auth] Aviso ao atualizar displayName no Firebase:', profileErr);
      }

      this.currentFirebaseUser = fbUser;
      const user: User = {
        id: fbUser.uid,
        name: trimmedName || fbUser.email?.split('@')[0] || 'Usuário',
        email: fbUser.email || trimmedEmail,
        avatarUrl: undefined,
        patientIds: [],
      };
      this.currentUser = user;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      this.notifyListeners();
      return user;
    } catch (error: any) {
      console.error('[Auth] Erro ao registrar nova conta no Firebase:', error);
      throw new Error(formatFirebaseAuthError(error, 'Erro ao criar conta. Verifique os dados informados e tente novamente.'));
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    if (!auth || !isFirebaseConfigured) {
      throw new Error('Firebase Authentication não está configurado neste ambiente.');
    }

    const trimmedEmail = email?.trim() || '';
    if (!trimmedEmail) {
      throw new Error('Informe seu e-mail para solicitar a redefinição de senha.');
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch (error: any) {
      const code = error?.code || '';
      console.warn('[Auth] Aviso ao solicitar redefinição de senha:', code);
      if (code === 'auth/invalid-email') {
        throw new Error('O formato do e-mail informado é inválido.');
      }
      if (code === 'auth/network-request-failed') {
        throw new Error('Falha de conexão com os servidores. Verifique sua internet e tente novamente.');
      }
    }
  }

  async sendEmailVerification(): Promise<void> {
    const fbUser = this.getFirebaseUser();
    if (!fbUser) throw new Error('Usuário não autenticado.');
    try {
      await firebaseSendEmailVerification(fbUser);
    } catch (error: any) {
      console.error('[Auth] Erro ao enviar e-mail de verificação:', error);
      if (error?.code === 'auth/too-many-requests') {
        throw new Error('Muitas solicitações recentes. Aguarde alguns instantes antes de reenviar.');
      }
      throw new Error('Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.');
    }
  }

  async reloadUser(): Promise<FirebaseUser | null> {
    const fbUser = this.getFirebaseUser();
    if (fbUser) {
      await fbUser.reload();
      this.currentFirebaseUser = auth?.currentUser || fbUser;
      return this.currentFirebaseUser;
    }
    return null;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const fbUser = this.getFirebaseUser();
    if (!fbUser || !fbUser.email) {
      throw new Error('Usuário não autenticado.');
    }

    const isPasswordUser = fbUser.providerData.some((p) => p.providerId === 'password');
    if (!isPasswordUser) {
      throw new Error('Seu acesso é gerenciado pela sua Conta Google. Não é possível alterar a senha por este canal.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }
    if (currentPassword === newPassword) {
      throw new Error('A nova senha não pode ser igual à senha atual.');
    }

    try {
      // Reauthenticate first with current password to ensure fresh session
      const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
      await reauthenticateWithCredential(fbUser, credential);
      await firebaseUpdatePassword(fbUser, newPassword);
    } catch (error: any) {
      console.error('[Auth] Erro ao alterar senha:', error);
      const code = error?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        throw new Error('Senha atual incorreta. Verifique e tente novamente.');
      } else if (code === 'auth/weak-password') {
        throw new Error('A nova senha informada é muito fraca. Escolha uma senha mais segura.');
      } else if (code === 'auth/requires-recent-login') {
        throw new Error('Sua sessão expirou. Por favor, saia e entre novamente antes de alterar a senha.');
      }
      throw new Error('Não foi possível alterar a senha. Verifique os dados e tente novamente.');
    }
  }

  getEnrolledMfaFactors(): MultiFactorInfo[] {
    const fbUser = this.getFirebaseUser();
    if (!fbUser) return [];
    try {
      return multiFactor(fbUser).enrolledFactors || [];
    } catch (e) {
      console.warn('[Auth] Erro ao obter fatores MFA:', e);
      return [];
    }
  }

  async startTotpMfaEnrollment(): Promise<{ secret: TotpSecret; qrCodeUrl: string; secretKey: string }> {
    const fbUser = this.getFirebaseUser();
    if (!fbUser) throw new Error('Usuário não autenticado.');

    if (!fbUser.emailVerified) {
      throw new Error('É necessário verificar seu endereço de e-mail antes de ativar o Autenticador (MFA).');
    }

    try {
      const session = await multiFactor(fbUser).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      const appName = 'SaudeFamiliar';
      const accountName = fbUser.email || 'usuario';
      const qrCodeUrl = secret.generateQrCodeUrl(accountName, appName);
      return {
        secret,
        qrCodeUrl,
        secretKey: secret.secretKey,
      };
    } catch (error: any) {
      console.error('[Auth] Erro ao iniciar enrollment TOTP:', error);
      const code = error?.code || '';
      if (code === 'auth/requires-recent-login') {
        throw new Error('Para sua segurança, faça login novamente antes de configurar o autenticador.');
      } else if (code === 'auth/unverified-email') {
        throw new Error('É necessário verificar seu e-mail antes de ativar o autenticador.');
      } else if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
        throw new Error('O recurso de MFA TOTP requer a ativação do Identity Platform no console do Google Cloud / Firebase.');
      }
      throw new Error('Não foi possível iniciar a configuração do autenticador. Tente novamente.');
    }
  }

  async finalizeTotpMfaEnrollment(
    secret: TotpSecret,
    verificationCode: string,
    displayName = 'Aplicativo Autenticador (TOTP)'
  ): Promise<void> {
    const fbUser = this.getFirebaseUser();
    if (!fbUser) throw new Error('Usuário não autenticado.');

    const cleanCode = verificationCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      throw new Error('Informe o código de 6 dígitos gerado pelo seu aplicativo autenticador.');
    }

    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, cleanCode);
      await multiFactor(fbUser).enroll(assertion, displayName);
    } catch (error: any) {
      console.error('[Auth] Erro ao finalizar enrollment TOTP:', error);
      const code = error?.code || '';
      if (code === 'auth/invalid-verification-code') {
        throw new Error('Código do autenticador incorreto ou expirado. Digite o código atual de 6 dígitos exibido no app.');
      } else if (code === 'auth/requires-recent-login') {
        throw new Error('Sua sessão expirou. Faça login novamente antes de concluir a ativação.');
      }
      throw new Error('Não foi possível validar o código do autenticador. Tente novamente.');
    }
  }

  async unenrollMfa(factorUid: string, options?: string | { password?: string; useGoogle?: boolean }): Promise<void> {
    const fbUser = this.getFirebaseUser();
    if (!fbUser) throw new Error('Usuário não autenticado.');

    const password = typeof options === 'string' ? options : options?.password;
    const useGoogle = typeof options === 'object' ? options?.useGoogle : false;

    try {
      if (useGoogle && googleProvider) {
        await reauthenticateWithPopup(fbUser, googleProvider);
      } else if (password && fbUser.email && fbUser.providerData.some((p) => p.providerId === 'password')) {
        const credential = EmailAuthProvider.credential(fbUser.email, password);
        await reauthenticateWithCredential(fbUser, credential);
      }
      await multiFactor(fbUser).unenroll(factorUid);
    } catch (error: any) {
      console.error('[Auth] Erro ao remover MFA:', error);
      const code = error?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        throw new Error('Senha atual incorreta.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('Confirmação do Google cancelada. É necessário confirmar sua identidade para desativar a proteção.');
      } else if (code === 'auth/requires-recent-login') {
        throw new Error('Por segurança, faça login novamente antes de desativar a autenticação em duas etapas.');
      }
      throw new Error('Não foi possível desativar a autenticação em duas etapas. Tente novamente.');
    }
  }

  async logout(): Promise<void> {
    if (auth && isFirebaseConfigured) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('[Auth] Erro ao deslogar do Firebase:', e);
      }
    }
    this.currentFirebaseUser = null;
    this.currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.notifyListeners();
  }

  async getUserAccesses(userId: string): Promise<PatientAccess[]> {
    const saved = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (saved) {
      try {
        const accesses: PatientAccess[] = JSON.parse(saved);
        return accesses.filter((a) => a.userId === userId);
      } catch {
        return [];
      }
    }
    return [];
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }
}

export const authService: IAuthService = new AuthServiceImplementation();

