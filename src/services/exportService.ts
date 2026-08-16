import { api } from './api';
import { Patient } from '../types';
import {
  generateEmptyTemplateWorkbook,
  generateDataExportWorkbook,
  downloadWorkbook,
  PatientExportPackage,
} from './exportTemplateV1';

export const exportService = {
  /**
   * Baixa a planilha modelo vazia (Template V1)
   */
  downloadTemplate(): void {
    const wb = generateEmptyTemplateWorkbook();
    downloadWorkbook(wb, 'Saude-Familiar-Template-v1.xlsx');
  },

  /**
   * Coleta os dados de todos os pacientes permitidos e gera o arquivo XLSX
   * Respeita rigorosamente o RBAC da sessão atual.
   */
  async exportUserData(
    patients: Patient[],
    onProgress?: (current: number, total: number, patientName: string) => void
  ): Promise<void> {
    if (!patients || patients.length === 0) {
      throw new Error('Nenhum paciente disponível para exportação.');
    }

    const packages: PatientExportPackage[] = [];
    const total = patients.length;

    for (let i = 0; i < total; i++) {
      const patient = patients[i];
      if (onProgress) {
        onProgress(i + 1, total, patient.name);
      }

      // Buscar todos os registros do paciente permitido
      const [medications, appointments, exams, documents, timelineEvents] = await Promise.all([
        api.getMedications(patient.id).catch(() => []),
        api.getAppointments(patient.id).catch(() => []),
        api.getExams(patient.id).catch(() => []),
        api.getDocuments(patient.id).catch(() => []),
        api.getTimeline(patient.id).catch(() => []),
      ]);

      packages.push({
        patient,
        medications,
        appointments,
        exams,
        documents,
        timelineEvents,
      });
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const fileName = `Saude-Familiar-Export-${yyyy}-${mm}-${dd}.xlsx`;

    const wb = generateDataExportWorkbook(packages);
    downloadWorkbook(wb, fileName);
  },
};
