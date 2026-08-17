import { User, PatientAccess } from '../types';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  isFirebaseConfigured,
  FirebaseUser,
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

export interface IAuthService {
  getCurrentUser(): User | null;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  login(credentials?: AuthCredentials): Promise<User>;
  register(name: string, email: string, password: string): Promise<User>;
  sendPasswordReset(email: string): Promise<void>;
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
      return 'O provedor de E-mail e Senha não está habilitado no Firebase Console. Ative o provedor Email/Password no Console do Firebase > Authentication > Sign-in method.';
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
        throw new Error(formatFirebaseAuthError(error, 'Não foi possível concluir o login com Google. Tente novamente.'));
      }
    }

    throw new Error('Método de autenticação não suportado.');
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
      // For security and preventing user enumeration, do not expose if user doesn't exist
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

