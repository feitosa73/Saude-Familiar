import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PatientProvider, usePatient } from './context/PatientContext';
import { LoginView } from './components/LoginView';
import { AccessDeniedView } from './components/AccessDeniedView';
import { FamilyOnboardingView } from './components/FamilyOnboardingView';
import { EmptyFamilyPatientsView } from './components/EmptyFamilyPatientsView';
import { Navbar } from './components/Navbar';
import { TabNavigation } from './components/TabNavigation';
import { DashboardView } from './components/DashboardView';
import { MedicationsView } from './components/MedicationsView';
import { AppointmentsView } from './components/AppointmentsView';
import { ExamsView } from './components/ExamsView';
import { DocumentsView } from './components/DocumentsView';
import { TimelineView } from './components/TimelineView';
import { PatientProfileModal } from './components/PatientProfileModal';
import { NewPatientModal } from './components/NewPatientModal';
import { NotificationToast } from './components/NotificationToast';
import { AnimatePresence, motion } from 'motion/react';

const MainContent: React.FC = () => {
  const {
    user,
    family,
    membership,
    accessStatus,
    statusMessage,
    refreshUserMe,
    logout,
    isLoading: isAuthLoading,
  } = useAuth();
  const { activeTab, isInitialLoading, patients } = usePatient();

  // Modal triggers across views
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isAptModalOpen, setIsAptModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

  // Link between exam and document upload
  const [examIdForDoc, setExamIdForDoc] = useState<string | null>(null);

  const handleOpenDocFromExam = (examId: string) => {
    setExamIdForDoc(examId);
    setIsDocModalOpen(true);
  };

  // If unauthenticated (no Firebase Auth user), render Login Screen
  if (accessStatus === 'unauthenticated' || (!user && accessStatus !== 'loading')) {
    return <LoginView />;
  }

  // Initial loading state
  if (accessStatus === 'loading' || (isAuthLoading && !user)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-6">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-900">Saúde Familiar</h2>
        <p className="text-sm text-slate-500 mt-1">Carregando prontuário e autorização...</p>
      </div>
    );
  }

  // If user is authenticated in Firebase Auth, but does not have a family membership yet
  if (accessStatus === 'no_membership') {
    return (
      <FamilyOnboardingView
        user={user}
        onFamilyCreated={refreshUserMe}
        onRefreshMemberships={refreshUserMe}
        onLogout={logout}
      />
    );
  }

  // If user has non-active membership or other access blocking states
  if (
    accessStatus === 'pending' ||
    accessStatus === 'disabled' ||
    accessStatus === 'firestore_not_initialized' ||
    accessStatus === 'error'
  ) {
    return (
      <AccessDeniedView
        status={accessStatus}
        user={user}
        family={family}
        membership={membership}
        statusMessage={statusMessage}
        onRefresh={refreshUserMe}
        onLogout={logout}
      />
    );
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-6">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-900">Saúde Familiar</h2>
        <p className="text-sm text-slate-500 mt-1">Carregando dados dos pacientes...</p>
      </div>
    );
  }

  const hasNoPatients = patients.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar onOpenNewPatient={() => setIsNewPatientModalOpen(true)} />

      {/* Navigation Tabs (Desktop Top & Mobile Bottom) */}
      <TabNavigation />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 md:pb-12">
        {hasNoPatients ? (
          <EmptyFamilyPatientsView onOpenNewPatient={() => setIsNewPatientModalOpen(true)} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === 'dashboard' && (
                <DashboardView
                  onOpenMedicationModal={() => setIsMedModalOpen(true)}
                  onOpenAppointmentModal={() => setIsAptModalOpen(true)}
                  onOpenExamModal={() => setIsExamModalOpen(true)}
                  onOpenDocumentModal={() => setIsDocModalOpen(true)}
                />
              )}

              {activeTab === 'medicamentos' && (
                <MedicationsView
                  isModalOpen={isMedModalOpen}
                  onOpenModal={() => setIsMedModalOpen(true)}
                  onCloseModal={() => setIsMedModalOpen(false)}
                />
              )}

              {activeTab === 'consultas' && (
                <AppointmentsView
                  isModalOpen={isAptModalOpen}
                  onOpenModal={() => setIsAptModalOpen(true)}
                  onCloseModal={() => setIsAptModalOpen(false)}
                />
              )}

              {activeTab === 'exames' && (
                <ExamsView
                  isModalOpen={isExamModalOpen}
                  onOpenModal={() => setIsExamModalOpen(true)}
                  onCloseModal={() => setIsExamModalOpen(false)}
                  onOpenDocumentUploadWithExam={handleOpenDocFromExam}
                />
              )}

              {activeTab === 'documentos' && (
                <DocumentsView
                  isModalOpen={isDocModalOpen}
                  onOpenModal={() => {
                    setExamIdForDoc(null);
                    setIsDocModalOpen(true);
                  }}
                  onCloseModal={() => {
                    setIsDocModalOpen(false);
                    setExamIdForDoc(null);
                  }}
                  preselectedExamId={examIdForDoc}
                />
              )}

              {activeTab === 'linha_tempo' && (
                <TimelineView
                  isModalOpen={isTimelineModalOpen}
                  onOpenModal={() => setIsTimelineModalOpen(true)}
                  onCloseModal={() => setIsTimelineModalOpen(false)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Global Modals */}
      <PatientProfileModal />
      <NewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
      />

      {/* Floating Feedback Toasts */}
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <PatientProvider>
        <MainContent />
      </PatientProvider>
    </AuthProvider>
  );
}
