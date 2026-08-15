import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  PatientAccess,
  PatientRole,
  Family,
  FamilyMembership,
  UserMeResponse,
} from '../types';
import { authService, AuthCredentials } from '../services/authService';
import { authorizationService, PatientPermissions } from '../services/authorizationService';
import { api, ApiError } from '../services/api';

export type AuthAccessStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated_active'
  | 'no_membership'
  | 'pending'
  | 'disabled'
  | 'firestore_not_initialized'
  | 'error';

interface AuthContextType {
  user: User | null;
  family: Family | null;
  membership: FamilyMembership | null;
  families: Array<{ family: Family; membership: FamilyMembership }>;
  pendingRequestsCount: number;
  accessStatus: AuthAccessStatus;
  isOwner: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  statusMessage: string | null;
  patientAccesses: PatientAccess[];
  login: (credentials?: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserMe: () => Promise<void>;
  switchFamily: (familyId: string) => Promise<void>;
  getUserRoleForPatient: (patientId: string) => PatientRole | null;
  getPermissionsForPatient: (patientId: string) => PatientPermissions;
  refreshAccesses: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());
  const [family, setFamily] = useState<Family | null>(null);
  const [membership, setMembership] = useState<FamilyMembership | null>(null);
  const [families, setFamilies] = useState<Array<{ family: Family; membership: FamilyMembership }>>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [accessStatus, setAccessStatus] = useState<AuthAccessStatus>('loading');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [patientAccesses, setPatientAccesses] = useState<PatientAccess[]>([]);

  const fetchAccesses = useCallback(async (currentUserId?: string) => {
    const targetUserId = currentUserId || user?.id;
    if (!targetUserId) {
      setPatientAccesses([]);
      return;
    }
    try {
      const accesses = await authService.getUserAccesses(targetUserId);
      setPatientAccesses(accesses);
    } catch (e) {
      console.error('Error fetching user accesses:', e);
      setPatientAccesses([]);
    }
  }, [user?.id]);

  const loadAuthoritativeState = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setFamily(null);
      setMembership(null);
      setFamilies([]);
      setPendingRequestsCount(0);
      setAccessStatus('unauthenticated');
      setStatusMessage(null);
      setPatientAccesses([]);
      return;
    }

    setAccessStatus('loading');
    setStatusMessage(null);

    try {
      const meResponse: UserMeResponse = await api.getCurrentUser();
      
      setFamily(meResponse.family);
      setMembership(meResponse.membership);
      setFamilies(meResponse.families || []);
      setPendingRequestsCount(meResponse.pendingRequestsCount || 0);

      if (meResponse.family?.id) {
        api.setActiveFamilyId(meResponse.family.id);
      }

      if (!meResponse.membership || !meResponse.family) {
        setAccessStatus('no_membership');
        setStatusMessage('Usuário autenticado, mas sem vínculo de família ativo associado.');
      } else if (meResponse.membership.status === 'active') {
        setAccessStatus('authenticated_active');
        setStatusMessage(null);
      } else if (meResponse.membership.status === 'pending') {
        setAccessStatus('pending');
        setStatusMessage('Seu acesso à família está pendente de aprovação.');
      } else if (meResponse.membership.status === 'disabled') {
        setAccessStatus('disabled');
        setStatusMessage('Seu acesso à família foi desativado pelo administrador.');
      } else {
        setAccessStatus('no_membership');
        setStatusMessage('Status de membership inválido ou não autorizado.');
      }
    } catch (error: any) {
      console.error('[AuthContext] Erro ao carregar /user/me:', error);
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setAccessStatus('unauthenticated');
          setFamily(null);
          setMembership(null);
          setFamilies([]);
          setStatusMessage('Sessão expirada. Faça login novamente.');
          return;
        }
        if (error.status === 403) {
          if (error.code === 'MEMBERSHIP_PENDING') {
            setAccessStatus('pending');
            setStatusMessage('Acesso pendente de aprovação.');
          } else if (error.code === 'MEMBERSHIP_DISABLED') {
            setAccessStatus('disabled');
            setStatusMessage('Acesso desativado pelo administrador.');
          } else {
            setAccessStatus('no_membership');
            setStatusMessage(error.message || 'Sem membership ativa cadastrada.');
          }
          return;
        }
        if (error.status === 503 || error.code === 'FIRESTORE_NOT_INITIALIZED') {
          setAccessStatus('firestore_not_initialized');
          setStatusMessage('Banco Firestore ainda não provisionado');
          return;
        }
      }
      setAccessStatus('error');
      setStatusMessage(error.message || 'Erro ao validar autorização com o servidor.');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((updatedUser) => {
      setUser(updatedUser);
      loadAuthoritativeState(updatedUser);
      if (updatedUser) {
        fetchAccesses(updatedUser.id);
      } else {
        setPatientAccesses([]);
      }
    });

    return () => unsubscribe();
  }, [fetchAccesses, loadAuthoritativeState]);

  const switchFamily = async (familyId: string) => {
    setIsLoading(true);
    try {
      api.setActiveFamilyId(familyId);
      await loadAuthoritativeState(user);
      if (user?.id) {
        await fetchAccesses(user.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUserMe = async () => {
    setIsLoading(true);
    try {
      await loadAuthoritativeState(user);
      if (user?.id) {
        await fetchAccesses(user.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials?: AuthCredentials) => {
    setIsLoading(true);
    try {
      const loggedUser = await authService.login(credentials);
      setUser(loggedUser);
      await loadAuthoritativeState(loggedUser);
      await fetchAccesses(loggedUser.id);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      api.setActiveFamilyId(null);
      await authService.logout();
      setUser(null);
      setFamily(null);
      setMembership(null);
      setFamilies([]);
      setPendingRequestsCount(0);
      setAccessStatus('unauthenticated');
      setStatusMessage(null);
      setPatientAccesses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRoleForPatient = useCallback(
    (patientId: string): PatientRole | null => {
      if (!user) return null;
      if (membership?.role === 'owner') return 'ADMIN';
      return authorizationService.getUserRole(user.id, patientId, patientAccesses);
    },
    [user, membership, patientAccesses]
  );

  const getPermissionsForPatient = useCallback(
    (patientId: string): PatientPermissions => {
      if (!user || accessStatus !== 'authenticated_active') {
        return {
          role: null,
          roleLabel: 'Desconectado / Sem Acesso',
          canView: false,
          canEditPatient: false,
          canDeletePatient: false,
          canCreateRecord: false,
          canEditRecord: false,
          canDeleteRecord: false,
          canManageAccess: false,
        };
      }

      if (membership?.role === 'owner') {
        return {
          role: 'ADMIN',
          roleLabel: 'Owner / Administrador da Família',
          canView: true,
          canEditPatient: true,
          canDeletePatient: true,
          canCreateRecord: true,
          canEditRecord: true,
          canDeleteRecord: true,
          canManageAccess: true,
        };
      }

      return authorizationService.getPermissions(user.id, patientId, patientAccesses);
    },
    [user, accessStatus, membership, patientAccesses]
  );

  const refreshAccesses = async () => {
    if (user?.id) {
      await fetchAccesses(user.id);
    }
  };

  const isOwner = membership?.role === 'owner' && accessStatus === 'authenticated_active';

  return (
    <AuthContext.Provider
      value={{
        user,
        family,
        membership,
        families,
        pendingRequestsCount,
        accessStatus,
        isOwner,
        isAuthenticated: !!user && accessStatus === 'authenticated_active',
        isLoading,
        statusMessage,
        patientAccesses,
        login,
        logout,
        refreshUserMe,
        switchFamily,
        getUserRoleForPatient,
        getPermissionsForPatient,
        refreshAccesses,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
