import { User, PatientAccess } from '../types';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  isFirebaseConfigured,
  FirebaseUser,
} from '../lib/firebase';

export interface AuthCredentials {
  provider?: 'google';
}

export interface IAuthService {
  getCurrentUser(): User | null;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  login(credentials?: AuthCredentials): Promise<User>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  getUserAccesses(userId: string): Promise<PatientAccess[]>;
}

const AUTH_STORAGE_KEY = 'saude_familiar_auth_user';
const ACCESS_STORAGE_KEY = 'saude_familiar_patient_accesses';

/**
 * Authentication Service (Integrated with Firebase Authentication)
 */
class AuthServiceImplementation implements IAuthService {
  private currentUser: User | null = null;
  private currentFirebaseUser: FirebaseUser | null = null;
  private listeners: ((user: User | null) => void)[] = [];

  constructor() {
    // Subscribe to Firebase Auth state if configured
    if (auth && isFirebaseConfigured) {
      onFirebaseAuthStateChanged(auth, async (fbUser) => {
        this.currentFirebaseUser = fbUser;
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
        this.notifyListeners();
      });
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (this.currentFirebaseUser) {
      try {
        const token = await this.currentFirebaseUser.getIdToken(forceRefresh);
        if (token) {
          return token;
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
    // Google Sign-In with Firebase Auth
    if (credentials?.provider === 'google' || !credentials) {
      if (auth && isFirebaseConfigured) {
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
          const code = error?.code || '';
          if (code === 'auth/popup-closed-by-user') {
            console.info('[Auth] Google Sign-In popup foi fechado pelo usuário.');
            throw new Error('A janela de login do Google foi fechada antes de concluir. Clique em "Entrar com Google" para tentar novamente.');
          }
          if (code === 'auth/cancelled-popup-request') {
            console.info('[Auth] Requisição de login cancelada ou substituída.');
            throw new Error('Tentativa de login anterior cancelada. Tente novamente.');
          }
          if (code === 'auth/popup-blocked') {
            console.warn('[Auth] Pop-up bloqueado pelo navegador.');
            throw new Error('A janela pop-up de login foi bloqueada pelo navegador. Permita pop-ups para este site para continuar.');
          }
          if (code === 'auth/unauthorized-domain') {
            const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
            console.warn('[Auth] Domínio não autorizado no Firebase Auth:', currentHost);
            throw new Error(
              `Domínio não autorizado no Firebase Auth (${currentHost}). Adicione este domínio em: Console Firebase > Authentication > Settings > Authorized domains.`
            );
          }
          if (code === 'auth/network-request-failed') {
            console.warn('[Auth] Falha de conexão de rede durante autenticação.');
            throw new Error('Não foi possível conectar aos servidores do Google. Verifique sua conexão com a internet e tente novamente.');
          }
          console.warn('[Auth] Aviso durante o Google Sign-In via Firebase:', error?.message || error);
          throw new Error(error?.message || 'Falha ao autenticar com o Google. Tente novamente.');
        }
      } else {
        throw new Error('Firebase Authentication não está configurado neste ambiente.');
      }
    }

    throw new Error('Autenticação via Firebase Authentication (Google Sign-In) obrigatória.');
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
