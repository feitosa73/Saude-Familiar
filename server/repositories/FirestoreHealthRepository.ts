import { getFirebaseFirestore } from '../lib/firebaseAdmin';
import {
  Patient,
  Medication,
  Appointment,
  Exam,
  MedicalDocument,
  TimelineEvent,
  TimelineEventType,
  User,
  PatientAccess,
  PatientRole,
} from '../types';
import { IHealthRepository } from './IRepository';

export class FirestoreHealthRepository implements IHealthRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  // ==========================================
  // USERS & ACCESSES
  // ==========================================

  async getUsers(familyId?: string): Promise<User[]> {
    try {
      if (familyId) {
        // Obter membros da família cadastrados
        const membershipsSnap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('memberships')
          .get();

        const userIds = membershipsSnap.docs.map((doc) => doc.data().userId).filter(Boolean);
        if (userIds.length === 0) return [];

        const users: User[] = [];
        for (const uid of userIds) {
          const userDoc = await this.db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            const data = userDoc.data() || {};
            users.push({
              id: uid,
              name: data.displayName || data.name || 'Membro da Família',
              email: data.email || '',
              avatarUrl: data.avatarUrl || data.photoURL,
              patientIds: data.patientIds || [],
            });
          } else {
            users.push({
              id: uid,
              name: 'Membro da Família',
              email: '',
              patientIds: [],
            });
          }
        }
        return users;
      }

      // Caso não haja familyId, lista usuários cadastrados na coleção users
      const snap = await this.db.collection('users').get();
      return snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.displayName || data.name || 'Usuário',
          email: data.email || '',
          avatarUrl: data.avatarUrl || data.photoURL,
          patientIds: data.patientIds || [],
        };
      });
    } catch (error) {
      console.error('[FirestoreHealthRepository] Erro ao buscar usuários:', error);
      return [];
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const snap = await this.db.collection('users').doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      return {
        id: snap.id,
        name: data.displayName || data.name || 'Usuário',
        email: data.email || '',
        avatarUrl: data.avatarUrl || data.photoURL,
        patientIds: data.patientIds || [],
      };
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar usuário ${id}:`, error);
      return null;
    }
  }

  async getPatientAccesses(patientId?: string, userId?: string, familyId?: string): Promise<PatientAccess[]> {
    try {
      if (familyId && patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('accesses')
          .get();

        let accesses = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PatientAccess));
        if (userId) {
          accesses = accesses.filter((a) => a.userId === userId);
        }
        return accesses;
      }

      if (familyId) {
        // Buscar em todos os pacientes da família
        const patients = await this.getPatients(undefined, familyId);
        const results: PatientAccess[] = [];
        for (const p of patients) {
          const accs = await this.getPatientAccesses(p.id, userId, familyId);
          results.push(...accs);
        }
        return results;
      }

      return [];
    } catch (error) {
      console.error('[FirestoreHealthRepository] Erro ao buscar acessos:', error);
      return [];
    }
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    try {
      if (!familyId) {
        return null;
      }

      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('accesses')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() } as PatientAccess;
    } catch (error) {
      console.error('[FirestoreHealthRepository] Erro ao obter acesso do paciente:', error);
      return null;
    }
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    if (!familyId) {
      throw new Error('familyId é obrigatório para registrar acesso a paciente');
    }

    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newAccess: PatientAccess = {
      id: accessId,
      patientId: data.patientId,
      userId: data.userId,
      role: data.role,
      createdAt: now,
      createdBy: data.createdBy,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('accesses')
      .doc(accessId)
      .set(newAccess);

    return newAccess;
  }

  async updatePatientAccess(
    id: string,
    role: PatientRole,
    familyId?: string,
    patientId?: string
  ): Promise<PatientAccess | null> {
    if (!familyId || !patientId) {
      throw new Error('familyId e patientId são necessários para atualizar acesso');
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(id);

    const snap = await ref.get();
    if (!snap.exists) return null;

    await ref.update({ role, updatedAt: new Date().toISOString() });
    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as PatientAccess;
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) {
      return false;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(id);

    const snap = await ref.get();
    if (!snap.exists) return false;

    await ref.delete();
    return true;
  }

  // ==========================================
  // PATIENTS
  // ==========================================

  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .orderBy('name', 'asc')
        .get();

      let patients = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Patient));

      // Se for filtrado por usuário (membro não-owner), filtra apenas pacientes que ele tem acesso
      if (userId) {
        const filtered: Patient[] = [];
        for (const p of patients) {
          const access = await this.getPatientAccess(userId, p.id, familyId);
          if (access) {
            filtered.push(p);
          }
        }
        return filtered;
      }

      return patients;
    } catch (error) {
      console.error('[FirestoreHealthRepository] Erro ao listar pacientes:', error);
      return [];
    }
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id)
        .get();

      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as Patient;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar paciente ${id}:`, error);
      return null;
    }
  }

  async createPatient(
    data: Omit<Patient, 'id'>,
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    if (!familyId) {
      throw new Error('familyId é obrigatório para criar paciente');
    }

    const patientId = `pat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newPatient: Patient = {
      ...data,
      id: patientId,
    };

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId);

    const batch = this.db.batch();
    batch.set(patientRef, {
      ...newPatient,
      createdAt: now,
      updatedAt: now,
    });

    // Se houver criador identificado, concede acesso ADMIN automático
    if (createdByUserId) {
      const accessId = `acc_${Date.now()}_admin`;
      const accessRef = patientRef.collection('accesses').doc(accessId);
      batch.set(accessRef, {
        id: accessId,
        patientId,
        userId: createdByUserId,
        role: 'ADMIN',
        createdAt: now,
        createdBy: createdByUserId,
      });
    }

    // Cria evento inicial na timeline do paciente
    const eventId = `evt_${Date.now()}_init`;
    const eventRef = patientRef.collection('timeline').doc(eventId);
    batch.set(eventRef, {
      id: eventId,
      patientId,
      type: 'evento_manual',
      title: 'Cadastro no Saúde Familiar',
      description: `Perfil clínico de ${data.name} criado no sistema.`,
      date: now.split('T')[0],
      category: 'Geral',
      important: true,
      createdAt: now,
    });

    await batch.commit();
    return newPatient;
  }

  async updatePatient(id: string, data: Partial<Patient>, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    try {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return null;

      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };

      await ref.set(updateData, { merge: true });
      const updatedSnap = await ref.get();
      return { id: updatedSnap.id, ...updatedSnap.data() } as Patient;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao atualizar paciente ${id}:`, error);
      return null;
    }
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    if (!familyId) return false;

    try {
      const patientRef = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(id);

      const snap = await patientRef.get();
      if (!snap.exists) return false;

      // Exclui subcoleções clínicas do paciente
      const subcollections = ['medications', 'appointments', 'exams', 'documents', 'timeline', 'accesses'];
      for (const sub of subcollections) {
        const subSnap = await patientRef.collection(sub).get();
        const batch = this.db.batch();
        subSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      await patientRef.delete();
      return true;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao excluir paciente ${id}:`, error);
      return false;
    }
  }

  // ==========================================
  // MEDICATIONS
  // ==========================================

  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('medications')
        .orderBy('name', 'asc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Medication));
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao listar medicamentos do paciente ${patientId}:`, error);
      return [];
    }
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('medications')
          .doc(id)
          .get();

        if (!snap.exists) return null;
        return { id: snap.id, ...snap.data() } as Medication;
      }

      // Se patientId não for conhecido, busca pelos pacientes da família
      const patients = await this.getPatients(undefined, familyId);
      for (const p of patients) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(p.id)
          .collection('medications')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as Medication;
        }
      }

      return null;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar medicamento ${id}:`, error);
      return null;
    }
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar medicamento');

    const medId = `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newMed: Medication = {
      ...data,
      id: medId,
    };

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const medRef = patientRef.collection('medications').doc(medId);

    const batch = this.db.batch();
    batch.set(medRef, {
      ...newMed,
      createdAt: now,
      updatedAt: now,
    });

    // Cria evento automático na timeline
    const eventId = `evt_${Date.now()}_med`;
    const eventRef = patientRef.collection('timeline').doc(eventId);
    batch.set(eventRef, {
      id: eventId,
      patientId: data.patientId,
      type: 'medicamento',
      title: `Início de medicação: ${data.name}`,
      description: `${data.dosage} - ${data.frequency} (${data.times.join(', ')})`,
      date: data.startDate || now.split('T')[0],
      category: 'Medicamento',
      referenceId: medId,
      doctor: data.prescribingDoctor,
      important: false,
      createdAt: now,
    });

    await batch.commit();
    return newMed;
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    const existing = await this.getMedicationById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('medications')
      .doc(id);

    await ref.set(
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as Medication;
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getMedicationById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('medications')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // APPOINTMENTS
  // ==========================================

  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('appointments')
        .orderBy('dateTime', 'asc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Appointment));
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao listar consultas do paciente ${patientId}:`, error);
      return [];
    }
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('appointments')
          .doc(id)
          .get();

        if (!snap.exists) return null;
        return { id: snap.id, ...snap.data() } as Appointment;
      }

      const patients = await this.getPatients(undefined, familyId);
      for (const p of patients) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(p.id)
          .collection('appointments')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as Appointment;
        }
      }

      return null;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar consulta ${id}:`, error);
      return null;
    }
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    if (!familyId) throw new Error('familyId é obrigatório para agendar consulta');

    const apptId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newAppt: Appointment = {
      ...data,
      id: apptId,
    };

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const apptRef = patientRef.collection('appointments').doc(apptId);

    const batch = this.db.batch();
    batch.set(apptRef, {
      ...newAppt,
      createdAt: now,
      updatedAt: now,
    });

    // Cria evento correspondente na linha do tempo
    const eventId = `evt_${Date.now()}_apt`;
    const eventRef = patientRef.collection('timeline').doc(eventId);
    batch.set(eventRef, {
      id: eventId,
      patientId: data.patientId,
      type: 'consulta',
      title: `Consulta: ${data.specialty}`,
      description: `${data.professional} - ${data.location} | Motivo: ${data.reason}`,
      date: data.dateTime.split('T')[0],
      category: 'Consulta',
      referenceId: apptId,
      doctor: data.professional,
      important: true,
      createdAt: now,
    });

    await batch.commit();
    return newAppt;
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    const existing = await this.getAppointmentById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('appointments')
      .doc(id);

    await ref.set(
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as Appointment;
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getAppointmentById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('appointments')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // EXAMS
  // ==========================================

  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('exams')
        .orderBy('requestDate', 'desc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Exam));
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao listar exames do paciente ${patientId}:`, error);
      return [];
    }
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('exams')
          .doc(id)
          .get();

        if (!snap.exists) return null;
        return { id: snap.id, ...snap.data() } as Exam;
      }

      const patients = await this.getPatients(undefined, familyId);
      for (const p of patients) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(p.id)
          .collection('exams')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as Exam;
        }
      }

      return null;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar exame ${id}:`, error);
      return null;
    }
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar exame');

    const examId = `ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newExam: Exam = {
      ...data,
      id: examId,
    };

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const examRef = patientRef.collection('exams').doc(examId);

    const batch = this.db.batch();
    batch.set(examRef, {
      ...newExam,
      createdAt: now,
      updatedAt: now,
    });

    // Cria evento na timeline
    const eventId = `evt_${Date.now()}_exam`;
    const eventRef = patientRef.collection('timeline').doc(eventId);
    batch.set(eventRef, {
      id: eventId,
      patientId: data.patientId,
      type: 'exame',
      title: `Exame solicitado: ${data.name}`,
      description: `Médico solicitante: ${data.requestingDoctor} | Status: ${data.status}`,
      date: data.requestDate || now.split('T')[0],
      category: 'Exame',
      referenceId: examId,
      doctor: data.requestingDoctor,
      important: false,
      createdAt: now,
    });

    await batch.commit();
    return newExam;
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    const existing = await this.getExamById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('exams')
      .doc(id);

    await ref.set(
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as Exam;
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getExamById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('exams')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // DOCUMENTS
  // ==========================================

  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('documents')
        .orderBy('date', 'desc')
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MedicalDocument));
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao listar documentos do paciente ${patientId}:`, error);
      return [];
    }
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    if (!familyId) return null;

    try {
      if (patientId) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(patientId)
          .collection('documents')
          .doc(id)
          .get();

        if (!snap.exists) return null;
        return { id: snap.id, ...snap.data() } as MedicalDocument;
      }

      const patients = await this.getPatients(undefined, familyId);
      for (const p of patients) {
        const snap = await this.db
          .collection('families')
          .doc(familyId)
          .collection('patients')
          .doc(p.id)
          .collection('documents')
          .doc(id)
          .get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as MedicalDocument;
        }
      }

      return null;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar documento ${id}:`, error);
      return null;
    }
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    if (!familyId) throw new Error('familyId é obrigatório para anexar documento');

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newDoc: MedicalDocument = {
      ...data,
      id: docId,
    };

    const patientRef = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId);

    const docRef = patientRef.collection('documents').doc(docId);

    const batch = this.db.batch();
    batch.set(docRef, {
      ...newDoc,
      createdAt: now,
      updatedAt: now,
    });

    // Cria evento correspondente na timeline
    const eventId = `evt_${Date.now()}_doc`;
    const eventRef = patientRef.collection('timeline').doc(eventId);
    batch.set(eventRef, {
      id: eventId,
      patientId: data.patientId,
      type: 'documento',
      title: `Documento anexado: ${data.title}`,
      description: `Categoria: ${data.category} | Arquivo: ${data.fileName}`,
      date: data.date || now.split('T')[0],
      category: 'Documento',
      referenceId: docId,
      doctor: data.doctor,
      important: false,
      createdAt: now,
    });

    await batch.commit();
    return newDoc;
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    const existing = await this.getDocumentById(id, familyId, patientId);
    if (!existing || !familyId) return null;

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('documents')
      .doc(id);

    await ref.set(
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as MedicalDocument;
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    const existing = await this.getDocumentById(id, familyId, patientId);
    if (!existing || !familyId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(existing.patientId)
      .collection('documents')
      .doc(id)
      .delete();

    return true;
  }

  // ==========================================
  // TIMELINE
  // ==========================================

  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    if (!familyId) return [];

    try {
      const snap = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('timeline')
        .orderBy('date', 'desc')
        .get();

      let events = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TimelineEvent));

      if (filter) {
        if (filter.category) {
          events = events.filter((e) => e.category === filter.category);
        }
        if (filter.type) {
          events = events.filter((e) => e.type === filter.type);
        }
        if (filter.startDate) {
          events = events.filter((e) => e.date >= filter.startDate!);
        }
        if (filter.endDate) {
          events = events.filter((e) => e.date <= filter.endDate!);
        }
      }

      return events;
    } catch (error) {
      console.error(`[FirestoreHealthRepository] Erro ao buscar timeline do paciente ${patientId}:`, error);
      return [];
    }
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent> {
    if (!familyId) throw new Error('familyId é obrigatório para registrar evento na timeline');

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newEvent: TimelineEvent = {
      ...data,
      id: eventId,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('timeline')
      .doc(eventId)
      .set({
        ...newEvent,
        createdAt: now,
      });

    return newEvent;
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    if (patientId) {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('timeline')
        .doc(id);

      const snap = await ref.get();
      if (!snap.exists) return false;
      await ref.delete();
      return true;
    }

    const patients = await this.getPatients(undefined, familyId);
    for (const p of patients) {
      const ref = this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(p.id)
        .collection('timeline')
        .doc(id);

      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
        return true;
      }
    }

    return false;
  }
}
