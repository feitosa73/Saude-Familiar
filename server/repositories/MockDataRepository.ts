import {
  Patient,
  Medication,
  Appointment,
  Exam,
  MedicalDocument,
  TimelineEvent,
  User,
  PatientAccess,
  PatientRole,
} from '../types';
import { IHealthRepository } from './IRepository';

export class MockDataRepository implements IHealthRepository {
  private users: User[] = [
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

  private patientAccesses: PatientAccess[] = [
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

  private patients: Patient[] = [
    {
      id: 'pat-1',
      name: 'Dona Francisca Silva',
      birthDate: '1947-04-15',
      bloodType: 'O+',
      allergies: ['Dipirona', 'Penicilina'],
      primaryDoctor: 'Dra. Helena Martins (Geriatra)',
      healthInsurance: 'Unimed Pleno',
      healthInsuranceNumber: '0054-9823-1120',
      notes: 'Paciente hipertensa e com osteoporose controlada. Necessita de acompanhamento semestral de densitometria e exames laboratoriais.',
      emergencyContacts: [
        { name: 'Mariana Silva (Filha)', phone: '(11) 98765-4321', relation: 'Filha' },
        { name: 'Carlos Silva (Filho)', phone: '(11) 97654-3210', relation: 'Filho' },
        { name: 'Dra. Helena Martins (Médica)', phone: '(11) 3456-7890', relation: 'Geriatra' },
      ],
    },
    {
      id: 'pat-2',
      name: 'Sr. Antônio Ferreira',
      birthDate: '1943-11-20',
      bloodType: 'A+',
      allergies: ['Aspirina / AAS'],
      primaryDoctor: 'Dr. Roberto Mendes (Cardiologista)',
      healthInsurance: 'Bradesco Saúde Top',
      healthInsuranceNumber: '0129-4458-9901',
      notes: 'Histórico de arritmia cardíaca e diabetes tipo 2. Faz controle diário de glicemia.',
      emergencyContacts: [
        { name: 'Mariana Silva (Sobrinha)', phone: '(11) 98765-4321', relation: 'Sobrinha' },
        { name: 'Paulo Ferreira (Irmão)', phone: '(11) 99123-4567', relation: 'Irmão' },
      ],
    },
  ];

  private medications: Medication[] = [
    {
      id: 'med-1',
      patientId: 'pat-1',
      name: 'Losartana Potássica',
      dosage: '50mg',
      frequency: '1 comprimido a cada 12 horas',
      times: ['08:00', '20:00'],
      startDate: '2025-01-10',
      prescribingDoctor: 'Dr. Lucas Arantes (Cardiologista)',
      notes: 'Tomar com um copo de água após o desjejum e jantar. Não interromper sem aviso.',
      active: true,
    },
    {
      id: 'med-2',
      patientId: 'pat-1',
      name: 'Colecalciferol (Vitamina D3)',
      dosage: '7.000 UI',
      frequency: '1 cápsula por semana (aos Domingos)',
      times: ['09:00'],
      startDate: '2025-06-01',
      prescribingDoctor: 'Dra. Helena Martins (Geriatra)',
      notes: 'Suplementação recomendada para manutenção óssea.',
      active: true,
    },
    {
      id: 'med-3',
      patientId: 'pat-1',
      name: 'Carbonato de Cálcio + D3',
      dosage: '600mg',
      frequency: '1 comprimido ao dia após o almoço',
      times: ['13:00'],
      startDate: '2025-03-15',
      prescribingDoctor: 'Dra. Helena Martins (Geriatra)',
      notes: 'Para prevenção e reforço de densidade mineral óssea.',
      active: true,
    },
    {
      id: 'med-4',
      patientId: 'pat-1',
      name: 'Omeprazol',
      dosage: '20mg',
      frequency: '1 cápsula pela manhã em jejum',
      times: ['07:00'],
      startDate: '2025-02-01',
      endDate: '2025-04-01',
      prescribingDoctor: 'Dr. Lucas Arantes',
      notes: 'Tratamento de refluxo - encerrado com sucesso.',
      active: false,
    },
    // Patient 2 medications
    {
      id: 'med-5',
      patientId: 'pat-2',
      name: 'Cloridrato de Metformina',
      dosage: '850mg',
      frequency: '1 comprimido 2 vezes ao dia',
      times: ['08:30', '19:30'],
      startDate: '2024-11-01',
      prescribingDoctor: 'Dra. Camila Nogueira (Endocrinologista)',
      notes: 'Tomar imediatamente durante ou logo após as principais refeições.',
      active: true,
    },
    {
      id: 'med-6',
      patientId: 'pat-2',
      name: 'Atenolol',
      dosage: '25mg',
      frequency: '1 comprimido pela manhã',
      times: ['08:00'],
      startDate: '2024-10-15',
      prescribingDoctor: 'Dr. Roberto Mendes (Cardiologista)',
      notes: 'Monitorar frequência cardíaca semanalmente.',
      active: true,
    },
  ];

  private appointments: Appointment[] = [
    {
      id: 'apt-1',
      patientId: 'pat-1',
      specialty: 'Geriatria',
      professional: 'Dra. Helena Martins',
      location: 'Clínica Longevidade - Sala 402, Av. Paulista 1200',
      dateTime: '2026-08-25T14:30:00',
      reason: 'Consulta de rotina semestral e revisão dos exames laboratoriais.',
      notes: 'Levar os resultados do hemograma completo e lipidograma recente.',
      status: 'agendada',
    },
    {
      id: 'apt-2',
      patientId: 'pat-1',
      specialty: 'Oftalmologia',
      professional: 'Dr. Marcelo Fonseca',
      location: 'Instituto de Olhos - Rua Pamplona 340',
      dateTime: '2026-09-08T10:00:00',
      reason: 'Avaliação anual de pressão intraocular e acuidade visual.',
      notes: 'Necessita de acompanhante caso haja dilatação de pupila.',
      status: 'agendada',
    },
    {
      id: 'apt-3',
      patientId: 'pat-1',
      specialty: 'Cardiologia',
      professional: 'Dr. Lucas Arantes',
      location: 'Hospital Samaritano - Bloco B Consultório 12',
      dateTime: '2026-07-10T11:00:00',
      reason: 'Acompanhamento da pressão arterial e eletrocardiograma.',
      notes: 'Pressão aferida em 120x80 mmHg.',
      status: 'realizada',
      postConsultationNotes: 'Eletrocardiograma dentro dos padrões esperados para a idade. Ritmo sinusal preservado.',
      postConsultationGuidance: 'Manter Losartana 50mg 12/12h. Caminhadas leves 20 minutos 3x por semana.',
    },
    {
      id: 'apt-4',
      patientId: 'pat-2',
      specialty: 'Endocrinologia',
      professional: 'Dra. Camila Nogueira',
      location: 'Centro Médico Santa Rita - Sala 10',
      dateTime: '2026-08-28T16:00:00',
      reason: 'Controle de hemoglobina glicada e ajuste de dose.',
      notes: 'Apresentar o diário de glicemia capilar dos últimos 30 dias.',
      status: 'agendada',
    },
  ];

  private exams: Exam[] = [
    {
      id: 'ex-1',
      patientId: 'pat-1',
      name: 'Hemograma Completo + Perfil Lipídico e Glicemia de Jejum',
      requestDate: '2026-08-01',
      requestingDoctor: 'Dra. Helena Martins',
      executionDate: '2026-08-10',
      status: 'resultado_disponivel',
      notes: 'Jejum obrigatório de 8 a 12 horas. Realizado no Laboratório Fleury.',
      documentId: 'doc-1',
    },
    {
      id: 'ex-2',
      patientId: 'pat-1',
      name: 'Ecocardiograma Transtorácico com Doppler',
      requestDate: '2026-08-05',
      requestingDoctor: 'Dr. Lucas Arantes',
      executionDate: '2026-08-22',
      status: 'agendado',
      notes: 'Agendado no Hospital Alemão Oswaldo Cruz às 09:30.',
    },
    {
      id: 'ex-3',
      patientId: 'pat-1',
      name: 'Densitometria Óssea (Coluna Lombar e Fêmur)',
      requestDate: '2026-07-28',
      requestingDoctor: 'Dra. Helena Martins',
      status: 'solicitado',
      notes: 'Solicitação emitida para verificar evolução do tratamento com cálcio.',
    },
    {
      id: 'ex-4',
      patientId: 'pat-2',
      name: 'Hemoglobina Glicada (HbA1c) e Microalbuminúria',
      requestDate: '2026-08-02',
      requestingDoctor: 'Dra. Camila Nogueira',
      executionDate: '2026-08-08',
      status: 'resultado_disponivel',
      notes: 'Realizado no Delboni Auriemo.',
      documentId: 'doc-4',
    },
  ];

  private documents: MedicalDocument[] = [
    {
      id: 'doc-1',
      patientId: 'pat-1',
      title: 'Resultado de Exames Laboratoriais (Agosto 2026)',
      category: 'resultado_exame',
      fileUrl: '/mock-files/exames-sangue-ago2026.pdf',
      fileName: 'exames-laboratoriais-francisca-ago2026.pdf',
      fileType: 'application/pdf',
      fileSize: '1.4 MB',
      date: '2026-08-11',
      doctor: 'Dra. Helena Martins',
      notes: 'Glicemia: 92 mg/dL, Colesterol Total: 185 mg/dL, HDL: 52 mg/dL. Todos dentro das metas.',
      relatedExamId: 'ex-1',
    },
    {
      id: 'doc-2',
      patientId: 'pat-1',
      title: 'Receita Médica de Uso Contínuo - Losartana e Vitamina D',
      category: 'receita',
      fileUrl: '/mock-files/receita-continua-jul2026.pdf',
      fileName: 'receita-geriatria-jul2026.pdf',
      fileType: 'application/pdf',
      fileSize: '420 KB',
      date: '2026-07-10',
      doctor: 'Dr. Lucas Arantes',
      notes: 'Válida por 180 dias para retirada em farmácia popular / convênio.',
    },
    {
      id: 'doc-3',
      patientId: 'pat-1',
      title: 'Relatório Clínico e Atestado de Aptidão Física Leve',
      category: 'relatorio_medico',
      fileUrl: '/mock-files/relatorio-geriatrico-2026.pdf',
      fileName: 'relatorio-aptidao-hidroginastica.pdf',
      fileType: 'application/pdf',
      fileSize: '890 KB',
      date: '2026-06-20',
      doctor: 'Dra. Helena Martins',
      notes: 'Liberada para hidroginástica e fisioterapia motora preventiva.',
    },
    {
      id: 'doc-4',
      patientId: 'pat-2',
      title: 'Resultado HbA1c e Glicemia - Agosto 2026',
      category: 'resultado_exame',
      fileUrl: '/mock-files/exame-glicemia-antonio-ago2026.pdf',
      fileName: 'glicemia-hba1c-antonio.pdf',
      fileType: 'application/pdf',
      fileSize: '750 KB',
      date: '2026-08-09',
      doctor: 'Dra. Camila Nogueira',
      notes: 'HbA1c em 6.8% (meta < 7.0%). Boa resposta terapêutica à metformina.',
      relatedExamId: 'ex-4',
    },
  ];

  private timelineEvents: TimelineEvent[] = [
    {
      id: 'tml-1',
      patientId: 'pat-1',
      type: 'documento',
      title: 'Laudo de Exames de Sangue Anexado',
      description: 'Resultado disponível do Fleury com hemograma completo, perfil lipídico e glicemia estável.',
      date: '2026-08-11',
      category: 'Exames e Laudos',
      referenceId: 'doc-1',
      doctor: 'Dra. Helena Martins',
      important: false,
    },
    {
      id: 'tml-2',
      patientId: 'pat-1',
      type: 'exame',
      title: 'Realização de Coleta de Exames Laboratoriais',
      description: 'Coleta de sangue realizada em domicílio pela equipe Fleury.',
      date: '2026-08-10',
      category: 'Exames',
      referenceId: 'ex-1',
      doctor: 'Dra. Helena Martins',
      important: false,
    },
    {
      id: 'tml-3',
      patientId: 'pat-1',
      type: 'consulta',
      title: 'Consulta Cardiológica Semestral',
      description: 'Avaliação de rotina com Dr. Lucas Arantes. Pressão controlada (120x80), ritmo sinusal mantido.',
      date: '2026-07-10',
      category: 'Consultas',
      referenceId: 'apt-3',
      doctor: 'Dr. Lucas Arantes',
      important: true,
    },
    {
      id: 'tml-4',
      patientId: 'pat-1',
      type: 'medicamento',
      title: 'Ajuste de Suplementação de Vitamina D3',
      description: 'Início da dose semanal de 7.000 UI aos domingos após dosagem sérica de 24 ng/mL.',
      date: '2026-06-01',
      category: 'Medicamentos',
      referenceId: 'med-2',
      doctor: 'Dra. Helena Martins',
      important: true,
    },
    {
      id: 'tml-5',
      patientId: 'pat-1',
      type: 'evento_manual',
      title: 'Vacinação Anual Contra Gripe (Influenza) e Covid-19',
      description: 'Dose da vacina da gripe e reforço bivalente aplicados no posto de saúde da UBS Jardim Paulistano. Sem reações adversas.',
      date: '2026-05-18',
      category: 'Vacinas e Imunização',
      important: true,
    },
    {
      id: 'tml-6',
      patientId: 'pat-1',
      type: 'medicamento',
      title: 'Término do ciclo de Omeprazol 20mg',
      description: 'Encerramento do tratamento protetor gástrico de 60 dias conforme orientação médica.',
      date: '2026-04-01',
      category: 'Medicamentos',
      referenceId: 'med-4',
      doctor: 'Dr. Lucas Arantes',
      important: false,
    },
    // Patient 2 timeline
    {
      id: 'tml-7',
      patientId: 'pat-2',
      type: 'documento',
      title: 'Resultado de Hemoglobina Glicada Anexado',
      description: 'Laudo do Delboni com HbA1c em 6.8%, confirmando bom controle do diabetes.',
      date: '2026-08-09',
      category: 'Exames e Laudos',
      referenceId: 'doc-4',
      doctor: 'Dra. Camila Nogueira',
      important: true,
    },
    {
      id: 'tml-8',
      patientId: 'pat-2',
      type: 'evento_manual',
      title: 'Avaliação Nutricional e Adequação de Cardápio',
      description: 'Consulta domiciliar com nutricionista para controle glicêmico e aumento de ingestão de fibras.',
      date: '2026-07-15',
      category: 'Nutrição e Hábitos',
      important: false,
    },
  ];

  // Users & Access
  async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  async getPatientAccesses(patientId?: string, userId?: string): Promise<PatientAccess[]> {
    let list = [...this.patientAccesses];
    if (patientId) {
      list = list.filter((a) => a.patientId === patientId);
    }
    if (userId) {
      list = list.filter((a) => a.userId === userId);
    }
    return list;
  }

  async getPatientAccess(userId: string, patientId: string): Promise<PatientAccess | null> {
    return (
      this.patientAccesses.find((a) => a.userId === userId && a.patientId === patientId) || null
    );
  }

  async createPatientAccess(data: Omit<PatientAccess, 'id' | 'createdAt'>): Promise<PatientAccess> {
    const existing = this.patientAccesses.find(
      (a) => a.userId === data.userId && a.patientId === data.patientId
    );
    if (existing) {
      existing.role = data.role;
      return existing;
    }
    const newAccess: PatientAccess = {
      id: `acc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.patientAccesses.push(newAccess);

    // Also ensure user has patientId in patientIds list
    const user = this.users.find((u) => u.id === data.userId);
    if (user && !user.patientIds.includes(data.patientId)) {
      user.patientIds.push(data.patientId);
    }

    return newAccess;
  }

  async updatePatientAccess(id: string, role: PatientRole): Promise<PatientAccess | null> {
    const index = this.patientAccesses.findIndex((a) => a.id === id);
    if (index === -1) return null;
    this.patientAccesses[index].role = role;
    return this.patientAccesses[index];
  }

  async deletePatientAccess(id: string): Promise<boolean> {
    const index = this.patientAccesses.findIndex((a) => a.id === id);
    if (index === -1) return false;
    const access = this.patientAccesses[index];
    this.patientAccesses.splice(index, 1);

    // Remove from user patientIds if no other access for this patient
    const user = this.users.find((u) => u.id === access.userId);
    if (user) {
      const otherAccess = this.patientAccesses.some(
        (a) => a.userId === access.userId && a.patientId === access.patientId
      );
      if (!otherAccess) {
        user.patientIds = user.patientIds.filter((pid) => pid !== access.patientId);
      }
    }
    return true;
  }

  // Patients
  async getPatients(userId?: string): Promise<Patient[]> {
    if (!userId) return [...this.patients];
    const user = this.users.find((u) => u.id === userId);
    if (!user) return [];
    return this.patients.filter((p) => user.patientIds.includes(p.id));
  }

  async getPatientById(id: string): Promise<Patient | null> {
    return this.patients.find((p) => p.id === id) || null;
  }

  async createPatient(data: Omit<Patient, 'id'>, createdByUserId?: string): Promise<Patient> {
    const newPatient: Patient = {
      id: `pat-${Date.now()}`,
      ...data,
    };
    this.patients.push(newPatient);

    const creatorId = createdByUserId || this.users[0]?.id || 'usr-admin';

    // Auto grant ADMIN access to creator
    this.patientAccesses.push({
      id: `acc-${Date.now()}`,
      userId: creatorId,
      patientId: newPatient.id,
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
      createdBy: creatorId,
    });

    const user = this.users.find((u) => u.id === creatorId);
    if (user && !user.patientIds.includes(newPatient.id)) {
      user.patientIds.push(newPatient.id);
    }

    return newPatient;
  }

  async updatePatient(id: string, data: Partial<Patient>): Promise<Patient | null> {
    const index = this.patients.findIndex((p) => p.id === id);
    if (index === -1) return null;
    this.patients[index] = { ...this.patients[index], ...data };
    return this.patients[index];
  }

  async deletePatient(id: string): Promise<boolean> {
    const index = this.patients.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.patients.splice(index, 1);
    this.patientAccesses = this.patientAccesses.filter((a) => a.patientId !== id);
    this.medications = this.medications.filter((m) => m.patientId !== id);
    this.appointments = this.appointments.filter((a) => a.patientId !== id);
    this.exams = this.exams.filter((e) => e.patientId !== id);
    this.documents = this.documents.filter((d) => d.patientId !== id);
    this.timelineEvents = this.timelineEvents.filter((t) => t.patientId !== id);
    for (const u of this.users) {
      u.patientIds = u.patientIds.filter((pid) => pid !== id);
    }
    return true;
  }

  // Medications
  async getMedications(patientId: string): Promise<Medication[]> {
    return this.medications.filter((m) => m.patientId === patientId);
  }

  async getMedicationById(id: string): Promise<Medication | null> {
    return this.medications.find((m) => m.id === id) || null;
  }

  async createMedication(data: Omit<Medication, 'id'>): Promise<Medication> {
    const newMed: Medication = {
      id: `med-${Date.now()}`,
      ...data,
    };
    this.medications.push(newMed);

    // Auto-create timeline event for medication start
    await this.createTimelineEvent({
      patientId: newMed.patientId,
      type: 'medicamento',
      title: `Início do Medicamento: ${newMed.name} (${newMed.dosage})`,
      description: `Prescrito por ${newMed.prescribingDoctor || 'Médico'}. Posologia: ${newMed.frequency}. Horários: ${newMed.times.join(', ')}.`,
      date: newMed.startDate || new Date().toISOString().split('T')[0],
      category: 'Medicamentos',
      referenceId: newMed.id,
      doctor: newMed.prescribingDoctor,
      important: true,
    });

    return newMed;
  }

  async updateMedication(id: string, data: Partial<Medication>): Promise<Medication | null> {
    const index = this.medications.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const oldMed = this.medications[index];
    this.medications[index] = { ...oldMed, ...data };

    // If active changed to false, optionally register timeline event
    if (oldMed.active && data.active === false) {
      await this.createTimelineEvent({
        patientId: oldMed.patientId,
        type: 'medicamento',
        title: `Término / Suspensão: ${oldMed.name} (${oldMed.dosage})`,
        description: `O medicamento foi marcado como inativo.${data.notes ? ` Observação: ${data.notes}` : ''}`,
        date: data.endDate || new Date().toISOString().split('T')[0],
        category: 'Medicamentos',
        referenceId: oldMed.id,
        doctor: oldMed.prescribingDoctor,
        important: false,
      });
    }

    return this.medications[index];
  }

  async deleteMedication(id: string): Promise<boolean> {
    const index = this.medications.findIndex((m) => m.id === id);
    if (index === -1) return false;
    this.medications.splice(index, 1);
    return true;
  }

  // Appointments
  async getAppointments(patientId: string): Promise<Appointment[]> {
    return this.appointments.filter((a) => a.patientId === patientId);
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    return this.appointments.find((a) => a.id === id) || null;
  }

  async createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment> {
    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      ...data,
    };
    this.appointments.push(newApt);

    // Auto-create timeline event
    const eventDate = newApt.dateTime ? newApt.dateTime.split('T')[0] : new Date().toISOString().split('T')[0];
    await this.createTimelineEvent({
      patientId: newApt.patientId,
      type: 'consulta',
      title: `Consulta Agendada: ${newApt.specialty} com ${newApt.professional}`,
      description: `Local: ${newApt.location}. Motivo: ${newApt.reason}`,
      date: eventDate,
      category: 'Consultas',
      referenceId: newApt.id,
      doctor: newApt.professional,
      important: false,
    });

    return newApt;
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | null> {
    const index = this.appointments.findIndex((a) => a.id === id);
    if (index === -1) return null;
    const oldApt = this.appointments[index];
    this.appointments[index] = { ...oldApt, ...data };

    // If marked as 'realizada', add/update timeline event with guidance
    if (data.status === 'realizada' && oldApt.status !== 'realizada') {
      const eventDate = (data.dateTime || oldApt.dateTime).split('T')[0];
      await this.createTimelineEvent({
        patientId: oldApt.patientId,
        type: 'consulta',
        title: `Consulta Realizada: ${oldApt.specialty} (${oldApt.professional})`,
        description: `Orientações recebidas: ${data.postConsultationGuidance || data.postConsultationNotes || 'Consulta concluída com sucesso.'}`,
        date: eventDate,
        category: 'Consultas',
        referenceId: oldApt.id,
        doctor: oldApt.professional,
        important: true,
      });
    }

    return this.appointments[index];
  }

  async deleteAppointment(id: string): Promise<boolean> {
    const index = this.appointments.findIndex((a) => a.id === id);
    if (index === -1) return false;
    this.appointments.splice(index, 1);
    return true;
  }

  // Exams
  async getExams(patientId: string): Promise<Exam[]> {
    return this.exams.filter((e) => e.patientId === patientId);
  }

  async getExamById(id: string): Promise<Exam | null> {
    return this.exams.find((e) => e.id === id) || null;
  }

  async createExam(data: Omit<Exam, 'id'>): Promise<Exam> {
    const newExam: Exam = {
      id: `ex-${Date.now()}`,
      ...data,
    };
    this.exams.push(newExam);

    await this.createTimelineEvent({
      patientId: newExam.patientId,
      type: 'exame',
      title: `Exame Solicitado: ${newExam.name}`,
      description: `Solicitante: ${newExam.requestingDoctor}. Status: ${newExam.status}.`,
      date: newExam.requestDate || new Date().toISOString().split('T')[0],
      category: 'Exames',
      referenceId: newExam.id,
      doctor: newExam.requestingDoctor,
      important: false,
    });

    return newExam;
  }

  async updateExam(id: string, data: Partial<Exam>): Promise<Exam | null> {
    const index = this.exams.findIndex((e) => e.id === id);
    if (index === -1) return null;
    const oldExam = this.exams[index];
    this.exams[index] = { ...oldExam, ...data };

    if (data.status === 'resultado_disponivel' && oldExam.status !== 'resultado_disponivel') {
      await this.createTimelineEvent({
        patientId: oldExam.patientId,
        type: 'exame',
        title: `Resultado Disponível: ${oldExam.name}`,
        description: `O laudo do exame solicitado por ${oldExam.requestingDoctor} já está disponível para visualização.`,
        date: data.executionDate || new Date().toISOString().split('T')[0],
        category: 'Exames',
        referenceId: oldExam.id,
        doctor: oldExam.requestingDoctor,
        important: true,
      });
    }

    return this.exams[index];
  }

  async deleteExam(id: string): Promise<boolean> {
    const index = this.exams.findIndex((e) => e.id === id);
    if (index === -1) return false;
    this.exams.splice(index, 1);
    return true;
  }

  // Documents
  async getDocuments(patientId: string): Promise<MedicalDocument[]> {
    return this.documents.filter((d) => d.patientId === patientId);
  }

  async getDocumentById(id: string): Promise<MedicalDocument | null> {
    return this.documents.find((d) => d.id === id) || null;
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>): Promise<MedicalDocument> {
    const newDoc: MedicalDocument = {
      id: `doc-${Date.now()}`,
      ...data,
    };
    this.documents.push(newDoc);

    const categoryLabels: Record<string, string> = {
      pedido_exame: 'Pedido de Exame',
      resultado_exame: 'Resultado de Exame',
      receita: 'Receita Médica',
      relatorio_medico: 'Relatório Médico',
      outro: 'Documento',
    };

    await this.createTimelineEvent({
      patientId: newDoc.patientId,
      type: 'documento',
      title: `${categoryLabels[newDoc.category] || 'Documento'}: ${newDoc.title}`,
      description: `Arquivo ${newDoc.fileName} (${newDoc.fileSize}) adicionado ao prontuário.${newDoc.doctor ? ` Médico: ${newDoc.doctor}.` : ''}`,
      date: newDoc.date || new Date().toISOString().split('T')[0],
      category: 'Documentos',
      referenceId: newDoc.id,
      doctor: newDoc.doctor,
      important: newDoc.category === 'receita' || newDoc.category === 'relatorio_medico',
    });

    return newDoc;
  }

  async updateDocument(id: string, data: Partial<MedicalDocument>): Promise<MedicalDocument | null> {
    const index = this.documents.findIndex((d) => d.id === id);
    if (index === -1) return null;
    this.documents[index] = { ...this.documents[index], ...data };
    return this.documents[index];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const index = this.documents.findIndex((d) => d.id === id);
    if (index === -1) return false;
    this.documents.splice(index, 1);
    return true;
  }

  // Timeline
  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; startDate?: string; endDate?: string; type?: string }
  ): Promise<TimelineEvent[]> {
    let list = this.timelineEvents.filter((t) => t.patientId === patientId);

    if (filter?.category && filter.category !== 'todos') {
      list = list.filter((t) => t.category.toLowerCase().includes(filter.category!.toLowerCase()));
    }

    if (filter?.type && filter.type !== 'todos') {
      list = list.filter((t) => t.type === filter.type);
    }

    if (filter?.startDate) {
      list = list.filter((t) => t.date >= filter.startDate!);
    }

    if (filter?.endDate) {
      list = list.filter((t) => t.date <= filter.endDate!);
    }

    // Sort newest first
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
    const newEvent: TimelineEvent = {
      id: `tml-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...data,
    };
    this.timelineEvents.unshift(newEvent);
    return newEvent;
  }

  async deleteTimelineEvent(id: string): Promise<boolean> {
    const index = this.timelineEvents.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.timelineEvents.splice(index, 1);
    return true;
  }
}
