import { User, PatientAccess } from '../types';

export interface AuthCredentials {
  email?: string;
  password?: string;
  provider?: 'google' | 'password';
  userId?: string;
}

export interface IAuthService {
  getCurrentUser(): User | null;
  login(credentials?: AuthCredentials): Promise<User>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  getMockUsers(): User[];
  switchMockUser(userId: string): Promise<User>;
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
 * Authentication Service (Prepared for Firebase Authentication)
 *
 * Currently operates in development mock mode using client & server simulation.
 * To connect to real Firebase Auth in the future:
 * 1. Define VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc. in .env
 * 2. Initialize firebase/auth (signInWithPopup with GoogleAuthProvider or signInWithEmailAndPassword)
 * 3. Pass user credential token to API requests via Authorization: Bearer <token>
 */
class AuthServiceImplementation implements IAuthService {
  private currentUser: User | null = null;
  private listeners: ((user: User | null) => void)[] = [];

  constructor() {
    // Restore session from localStorage if present
    const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        console.error('Failed to parse cached auth user', e);
        this.currentUser = null;
      }
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  getMockUsers(): User[] {
    return MOCK_USERS;
  }

  async login(credentials?: AuthCredentials): Promise<User> {
    // Simulate network latency for authentic feel
    await new Promise((res) => setTimeout(res, 350));

    let user: User | undefined;

    if (credentials?.userId) {
      user = MOCK_USERS.find((u) => u.id === credentials.userId);
    } else if (credentials?.email) {
      user = MOCK_USERS.find((u) => u.email.toLowerCase() === credentials.email!.toLowerCase());
      if (!user) {
        // Create an ad-hoc demo user or map to first
        user = {
          id: `usr-custom-${Date.now()}`,
          name: credentials.email.split('@')[0],
          email: credentials.email,
          patientIds: ['pat-1'],
        };
      }
    } else if (credentials?.provider === 'google') {
      // Default to Paulo (Admin) for standard Google sign-in demo
      user = MOCK_USERS[0];
    } else {
      user = MOCK_USERS[0];
    }

    this.currentUser = user || MOCK_USERS[0];
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  }

  async logout(): Promise<void> {
    await new Promise((res) => setTimeout(res, 150));
    this.currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.notifyListeners();
  }

  async switchMockUser(userId: string): Promise<User> {
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`Usuário mock ${userId} não encontrado`);
    }
    this.currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
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
    // Trigger immediately with current state
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
