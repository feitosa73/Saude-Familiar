import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Patient, User } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

export type NavigationTab =
  | 'dashboard'
  | 'medicamentos'
  | 'consultas'
  | 'exames'
  | 'documentos'
  | 'linha_tempo';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface PatientContextType {
  currentUser: User | null;
  patients: Patient[];
  selectedPatient: Patient | null;
  activeTab: NavigationTab;
  isLoading: boolean;
  isInitialLoading: boolean;
  toasts: ToastMessage[];
  setSelectedPatientId: (id: string) => void;
  setActiveTab: (tab: NavigationTab) => void;
  refreshPatients: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  openPatientProfile: boolean;
  setOpenPatientProfile: (open: boolean) => void;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientIdState] = useState<string>('');
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [openPatientProfile, setOpenPatientProfile] = useState<boolean>(false);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshPatients = useCallback(async () => {
    if (!user) {
      setPatients([]);
      setSelectedPatientIdState('');
      setIsInitialLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const patientList = await api.getPatients();
      setPatients(patientList);

      // If no patient is selected or selected patient is not in list, select first
      if (patientList.length > 0) {
        setSelectedPatientIdState((currentId) => {
          if (!currentId || !patientList.some((p) => p.id === currentId)) {
            return patientList[0].id;
          }
          return currentId;
        });
      } else {
        setSelectedPatientIdState('');
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      showToast(err.message || 'Erro ao carregar dados do servidor', 'error');
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    refreshPatients();
  }, [refreshPatients, user?.id]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  const setSelectedPatientId = (id: string) => {
    setSelectedPatientIdState(id);
    const target = patients.find((p) => p.id === id);
    if (target) {
      showToast(`Visualizando prontuário de ${target.name}`, 'info');
    }
  };

  return (
    <PatientContext.Provider
      value={{
        currentUser: user,
        patients,
        selectedPatient,
        activeTab,
        isLoading,
        isInitialLoading,
        toasts,
        setSelectedPatientId,
        setActiveTab,
        refreshPatients,
        showToast,
        dismissToast,
        openPatientProfile,
        setOpenPatientProfile,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient deve ser usado dentro de PatientProvider');
  }
  return context;
};
