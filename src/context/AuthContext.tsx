import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, PatientAccess, PatientRole } from '../types';
import { authService, AuthCredentials, MOCK_USERS, MOCK_PATIENT_ACCESSES } from '../services/authService';
import { authorizationService, PatientPermissions } from '../services/authorizationService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  patientAccesses: PatientAccess[];
  mockUsers: User[];
  login: (credentials?: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  getUserRoleForPatient: (patientId: string) => PatientRole | null;
  getPermissionsForPatient: (patientId: string) => PatientPermissions;
  refreshAccesses: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [patientAccesses, setPatientAccesses] = useState<PatientAccess[]>(MOCK_PATIENT_ACCESSES);

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
      setPatientAccesses(MOCK_PATIENT_ACCESSES.filter((a) => a.userId === targetUserId));
    }
  }, [user?.id]);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((updatedUser) => {
      setUser(updatedUser);
      if (updatedUser) {
        fetchAccesses(updatedUser.id);
      } else {
        setPatientAccesses([]);
      }
    });

    if (user?.id) {
      fetchAccesses(user.id);
    }

    return () => unsubscribe();
  }, [fetchAccesses, user?.id]);

  const login = async (credentials?: AuthCredentials) => {
    setIsLoading(true);
    try {
      const loggedUser = await authService.login(credentials);
      setUser(loggedUser);
      await fetchAccesses(loggedUser.id);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setPatientAccesses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRoleForPatient = useCallback(
    (patientId: string): PatientRole | null => {
      if (!user) return null;
      return authorizationService.getUserRole(user.id, patientId, patientAccesses);
    },
    [user, patientAccesses]
  );

  const getPermissionsForPatient = useCallback(
    (patientId: string): PatientPermissions => {
      if (!user) {
        return {
          role: null,
          roleLabel: 'Desconectado',
          canView: false,
          canEditPatient: false,
          canDeletePatient: false,
          canCreateRecord: false,
          canEditRecord: false,
          canDeleteRecord: false,
          canManageAccess: false,
        };
      }
      return authorizationService.getPermissions(user.id, patientId, patientAccesses);
    },
    [user, patientAccesses]
  );

  const refreshAccesses = async () => {
    if (user?.id) {
      await fetchAccesses(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        patientAccesses,
        mockUsers: MOCK_USERS,
        login,
        logout,
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
