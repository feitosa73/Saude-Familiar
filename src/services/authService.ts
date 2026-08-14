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
  email?: string;
  password?: string;
  provider?: 'google' | 'password';
  userId?: string;
}

export interface IAuthService {
  getCurrentUser(): User | null;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  login(credentials?: AuthCredentials): Promise<User>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  getMockUsers(): User[];
  getUserAccesses(userId: string): Promise<PatientAccess[]>;
}

// Development Mock Users
export const MOCK_USERS: User[] = [
  {
    id: 'usr-admin',
    name: 'Paulo Silva',
    email: 'paulo.admin@saudefamiliar.com',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face',
    patientIds: ['pat-1', 'pat-2'],
  },
  {
    id: 'usr-caregiver',
    name: 'Mariana Silva',
    email: 'mariana.cuidadora@saudefamiliar.com',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&crop=face',
    patientIds: ['pat-1', 'pat-2'],
  },
  {
    id: 'usr-viewer',
    name: 'Carlos Silva',
    email: 'carlos.familiar@saudefamiliar.com',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face',
    patientIds: ['pat-1'],
  },
];

// Initial mock access relations
export const MOCK_PATIENT_ACCESSES: PatientAccess[] = [
  {
    id: 'acc-1',
    userId: 'usr-admin',
    patientId: 'pat-1',
    role: 'ADMIN',
    createdAt: '2025-01-01T00:00:00Z',
    createdBy: 'usr-admin',
  },
  {
    id: 'acc-2',
    userId: 'usr-admin',
    patientId: 'pat-2',
    role: 'ADMIN',
    createdAt: '2025-01-01T00:00:00Z',
    createdBy: 'usr-admin',
  },
  {
    id: 'acc-3',
    userId: 'usr-caregiver',
    patientId: 'pat-1',
    role: 'CAREGIVER',
    createdAt: '2025-01-10T10:00:00Z',
    createdBy: 'usr-admin',
  },
  {
    id: 'acc-4',
    userId: 'usr-caregiver',
    patientId: 'pat-2',
    role: 'VIEWER',
    createdAt: '2025-02-01T10:00:00Z',
    createdBy: 'usr-admin',
  },
  {
    id: 'acc-5',
    userId: 'usr-viewer',
    patientId: 'pat-1',
    role: 'VIEWER',
    createdAt: '2025-02-15T14:00:00Z',
    createdBy: 'usr-admin',
  },
];

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
            patientIds: ['pat-1'],
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

  getMockUsers(): User[] {
    return MOCK_USERS;
  }

  async login(credentials?: AuthCredentials): Promise<User> {
    // Google Sign-In with Firebase Auth
    if (credentials?.provider === 'google') {
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
            patientIds: ['pat-1'],
          };
          this.currentUser = user;
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
          this.notifyListeners();
          return user;
        } catch (error: any) {
          console.error('[Auth] Erro no Google Sign-In via Firebase:', error);
          if (error.code === 'auth/unauthorized-domain') {
            const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
            throw new Error(
              `Domínio não autorizado no Firebase Auth (${currentHost}). Adicione este domínio em: Console Firebase > Authentication > Settings > Authorized domains.`
            );
          }
          throw new Error(error.message || 'Falha ao autenticar com Google');
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
    let accesses: PatientAccess[] = MOCK_PATIENT_ACCESSES;
    if (saved) {
      try {
        accesses = JSON.parse(saved);
      } catch {
        accesses = MOCK_PATIENT_ACCESSES;
      }
    }
    return accesses.filter((a) => a.userId === userId);
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
