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
  CpfRegistryRecord,
} from '../types';
import { IHealthRepository } from './IRepository';
import {
  normalizeCpf,
  validateCpf,
  maskCpf,
  hashCpf,
  CpfDuplicateError,
} from '../utils/cpf';

/**
 * FirestoreHealthRepository
 *
 * Repositório autoritativo para entidades clínicas e de saúde utilizando Cloud Firestore.
 * Subcoleções estruturadas hierarquicamente sob families/{familyId}/patients/...
 */
export class FirestoreHealthRepository implements IHealthRepository {
  private get db() {
    return getFirebaseFirestore();
  }

  // =========================================================================
  // USERS & ACCESSES
  // =========================================================================

  async getUsers(familyId?: string): Promise<User[]> {
    if (!familyId) return [];

    const memSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('memberships')
      .get();

    if (memSnap.empty) {
      return [];
    }

    const users: User[] = [];
    for (const doc of memSnap.docs) {
      const uid = doc.id;
      const uDoc = await this.db.collection('users').doc(uid).get();
      const uData = uDoc.data() || {};
      users.push({
        id: uid,
        name: uData.displayName || 'Membro da Família',
        email: uData.email || '',
        avatarUrl: uData.photoURL || undefined,
        patientIds: [],
      });
    }

    return users;
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.db.collection('users').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() || {};
    return {
      id,
      name: data.displayName || 'Usuário',
      email: data.email || '',
      avatarUrl: data.photoURL || undefined,
      patientIds: [],
    };
  }

  async getPatientAccesses(
    patientId?: string,
    userId?: string,
    familyId?: string
  ): Promise<PatientAccess[]> {
    if (!familyId || !patientId) return [];

    let query: FirebaseFirestore.Query = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses');

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snap = await query.get();
    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PatientAccess));
  }

  async getPatientAccess(userId: string, patientId: string, familyId?: string): Promise<PatientAccess | null> {
    if (!familyId) return null;

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as PatientAccess;
  }

  async createPatientAccess(
    data: Omit<PatientAccess, 'id' | 'createdAt'>,
    familyId?: string
  ): Promise<PatientAccess> {
    if (!familyId) throw new Error('familyId é obrigatório para registrar acesso');

    const accessId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const access: PatientAccess = {
      id: accessId,
      ...data,
      createdAt: now,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('accesses')
      .doc(access.id)
      .set(access);

    return access;
  }

  async updatePatientAccess(
    id: string,
    role: PatientRole,
    familyId?: string,
    patientId?: string
  ): Promise<PatientAccess | null> {
    if (!familyId || !patientId) throw new Error('familyId e patientId são obrigatórios');

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ role, updatedAt: now });

    const updated = { id: doc.id, ...doc.data(), role, updatedAt: now } as PatientAccess;
    return updated;
  }

  async deletePatientAccess(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('accesses')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // PATIENTS
  // =========================================================================

  async getPatients(userId?: string, familyId?: string): Promise<Patient[]> {
    if (!familyId) return [];

    const snap = await this.db.collection('families').doc(familyId).collection('patients').get();
    if (snap.empty) {
      return [];
    }

    const list: Patient[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Patient));

    if (userId) {
      const famSnap = await this.db.collection('families').doc(familyId).get();
      const fam = famSnap.data();
      const isOwner = fam?.primaryOwnerUid === userId || fam?.createdBy === userId;

      if (!isOwner) {
        const allowedPatients: Patient[] = [];
        for (const p of list) {
          const acc = await this.getPatientAccess(userId, p.id, familyId);
          if (acc) {
            allowedPatients.push(p);
          }
        }
        return allowedPatients;
      }
    }

    return list;
  }

  async getPatientById(id: string, familyId?: string): Promise<Patient | null> {
    if (!familyId) return null;

    const doc = await this.db.collection('families').doc(familyId).collection('patients').doc(id).get();
    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() } as Patient;
  }

  async createPatient(
    data: Omit<Patient, 'id'> & { cpf?: string },
    createdByUserId?: string,
    familyId?: string
  ): Promise<Patient> {
    if (!familyId) throw new Error('familyId é obrigatório para cadastrar um paciente');

    const patientId = `pat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const { cpf, ...cleanData } = data;

    let cpfMasked = cleanData.cpfMasked;
    let cpfHash = cleanData.cpfHash;

    const pRef = this.db.collection('families').doc(familyId).collection('patients').doc(patientId);

    if (cpf && cpf.trim() !== '') {
      if (!validateCpf(cpf)) {
        throw new Error('CPF informado para o paciente é inválido.');
      }
      const norm = normalizeCpf(cpf);
      cpfHash = hashCpf(norm);
      cpfMasked = maskCpf(norm);

      await this.db.runTransaction(async (transaction) => {
        const regRef = this.db.collection('cpf_registry').doc(cpfHash!);
        const regDoc = await transaction.get(regRef);

        if (regDoc.exists) {
          const regData = regDoc.data() as CpfRegistryRecord;
          const existingPatientId =
            regData.patientId || (regData.entityType === 'patient' ? regData.entityId : null);
          if (existingPatientId && existingPatientId !== patientId) {
            throw new CpfDuplicateError(
              'Este CPF já está cadastrado para outro paciente no sistema. Caso este familiar já pertença a uma família, solicite acesso ao administrador responsável.',
              'patient'
            );
          }
        }

        const patient: Patient = {
          id: patientId,
          ...cleanData,
          cpfMasked,
          cpfHash,
          createdAt: now,
          updatedAt: now,
        };

        const regRecord: CpfRegistryRecord = {
          id: cpfHash!,
          ...(regDoc.exists ? (regDoc.data() as CpfRegistryRecord) : {}),
          patientId,
          patientFamilyId: familyId,
          createdAt: regDoc.exists ? regDoc.data()?.createdAt || now : now,
          updatedAt: now,
        };

        transaction.set(regRef, regRecord, { merge: true });
        transaction.set(pRef, patient);
      });
    } else {
      const patient: Patient = {
        id: patientId,
        ...cleanData,
        createdAt: now,
        updatedAt: now,
      };
      await pRef.set(patient);
    }

    if (createdByUserId) {
      await this.createPatientAccess(
        {
          patientId,
          userId: createdByUserId,
          role: 'ADMIN',
          createdBy: createdByUserId,
        },
        familyId
      );
    }

    return {
      id: patientId,
      ...cleanData,
      cpfMasked,
      cpfHash,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updatePatient(
    id: string,
    data: Partial<Patient> & { cpf?: string },
    familyId?: string
  ): Promise<Patient | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    const pRef = this.db.collection('families').doc(familyId).collection('patients').doc(id);
    const now = new Date().toISOString();
    const { cpf, ...cleanData } = data;

    if (cpf !== undefined) {
      const trimmed = cpf ? cpf.trim() : '';
      if (trimmed !== '') {
        if (!validateCpf(trimmed)) {
          throw new Error('CPF informado para o paciente é inválido.');
        }
        const norm = normalizeCpf(trimmed);
        const newHash = hashCpf(norm);
        const newMasked = maskCpf(norm);

        let updatedPatient: Patient | null = null;

        await this.db.runTransaction(async (transaction) => {
          const doc = await transaction.get(pRef);
          if (!doc.exists) {
            return;
          }
          const prev = doc.data() as Patient;

          if (prev.cpfHash !== newHash) {
            const regRef = this.db.collection('cpf_registry').doc(newHash);
            const regDoc = await transaction.get(regRef);
            if (regDoc.exists) {
              const regData = regDoc.data() as CpfRegistryRecord;
              const existingPatientId =
                regData.patientId || (regData.entityType === 'patient' ? regData.entityId : null);
              if (existingPatientId && existingPatientId !== id) {
                throw new CpfDuplicateError(
                  'Este CPF já está cadastrado para outro paciente no sistema. Caso este familiar já pertença a uma família, solicite acesso ao administrador responsável.',
                  'patient'
                );
              }
            }

            if (prev.cpfHash) {
              const oldRegRef = this.db.collection('cpf_registry').doc(prev.cpfHash);
              const oldRegDoc = await transaction.get(oldRegRef);
              if (oldRegDoc.exists) {
                const oldData = oldRegDoc.data() as CpfRegistryRecord;
                const hasUser = Boolean(oldData.userId || oldData.entityType === 'user');
                if (!hasUser) {
                  transaction.delete(oldRegRef);
                } else {
                  transaction.update(oldRegRef, {
                    patientId: null,
                    patientFamilyId: null,
                    entityType: 'user',
                  });
                }
              }
            }

            const regRecord: CpfRegistryRecord = {
              id: newHash,
              ...(regDoc.exists ? (regDoc.data() as CpfRegistryRecord) : {}),
              patientId: id,
              patientFamilyId: familyId,
              createdAt: regDoc.exists ? regDoc.data()?.createdAt || now : now,
              updatedAt: now,
            };
            transaction.set(regRef, regRecord, { merge: true });
          }

          const patch = {
            ...cleanData,
            cpfMasked: newMasked,
            cpfHash: newHash,
            updatedAt: now,
          };
          transaction.update(pRef, patch);
          updatedPatient = { id, ...prev, ...patch };
        });

        return updatedPatient;
      }
    }

    const doc = await pRef.get();
    if (!doc.exists) {
      return null;
    }

    await pRef.update({ ...cleanData, updatedAt: now });
    return { id, ...doc.data(), ...cleanData, updatedAt: now } as Patient;
  }

  async deletePatient(id: string, familyId?: string): Promise<boolean> {
    if (!familyId) return false;

    const pRef = this.db.collection('families').doc(familyId).collection('patients').doc(id);

    return await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(pRef);
      if (!doc.exists) {
        return false;
      }
      const data = doc.data() as Patient;
      if (data.cpfHash) {
        const regRef = this.db.collection('cpf_registry').doc(data.cpfHash);
        const regDoc = await transaction.get(regRef);
        if (regDoc.exists) {
          const regData = regDoc.data() as CpfRegistryRecord;
          const hasUser = Boolean(regData.userId || regData.entityType === 'user');
          if (!hasUser) {
            transaction.delete(regRef);
          } else {
            transaction.update(regRef, {
              patientId: null,
              patientFamilyId: null,
              entityType: 'user',
            });
          }
        }
      }
      transaction.delete(pRef);
      return true;
    });
  }

  // =========================================================================
  // MEDICATIONS
  // =========================================================================

  async getMedications(patientId: string, familyId?: string): Promise<Medication[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('medications')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Medication));
  }

  async getMedicationById(id: string, familyId?: string, patientId?: string): Promise<Medication | null> {
    if (!familyId) return null;

    if (patientId) {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('medications')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Medication;
      }
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('medications').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Medication;
      }
    }

    return null;
  }

  async createMedication(data: Omit<Medication, 'id'>, familyId?: string): Promise<Medication> {
    if (!familyId) throw new Error('familyId é obrigatório');

    const medId = `med_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const medication: Medication = {
      id: medId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('medications')
      .doc(medication.id)
      .set(medication);

    return medication;
  }

  async updateMedication(
    id: string,
    data: Partial<Medication>,
    familyId?: string,
    patientId?: string
  ): Promise<Medication | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getMedicationById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('medications')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as Medication;
  }

  async deleteMedication(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getMedicationById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('medications')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // APPOINTMENTS
  // =========================================================================

  async getAppointments(patientId: string, familyId?: string): Promise<Appointment[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('appointments')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Appointment));
  }

  async getAppointmentById(id: string, familyId?: string, patientId?: string): Promise<Appointment | null> {
    if (!familyId) return null;

    if (patientId) {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('appointments')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Appointment;
      }
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('appointments').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Appointment;
      }
    }

    return null;
  }

  async createAppointment(data: Omit<Appointment, 'id'>, familyId?: string): Promise<Appointment> {
    if (!familyId) throw new Error('familyId é obrigatório');

    const aptId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const appointment: Appointment = {
      id: aptId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('appointments')
      .doc(appointment.id)
      .set(appointment);

    return appointment;
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    familyId?: string,
    patientId?: string
  ): Promise<Appointment | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getAppointmentById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('appointments')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as Appointment;
  }

  async deleteAppointment(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getAppointmentById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('appointments')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // EXAMS
  // =========================================================================

  async getExams(patientId: string, familyId?: string): Promise<Exam[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('exams')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Exam));
  }

  async getExamById(id: string, familyId?: string, patientId?: string): Promise<Exam | null> {
    if (!familyId) return null;

    if (patientId) {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('exams')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Exam;
      }
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('exams').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as Exam;
      }
    }

    return null;
  }

  async createExam(data: Omit<Exam, 'id'>, familyId?: string): Promise<Exam> {
    if (!familyId) throw new Error('familyId é obrigatório');

    const examId = `exm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const exam: Exam = {
      id: examId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('exams')
      .doc(exam.id)
      .set(exam);

    return exam;
  }

  async updateExam(
    id: string,
    data: Partial<Exam>,
    familyId?: string,
    patientId?: string
  ): Promise<Exam | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getExamById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('exams')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as Exam;
  }

  async deleteExam(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getExamById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('exams')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // DOCUMENTS
  // =========================================================================

  async getDocuments(patientId: string, familyId?: string): Promise<MedicalDocument[]> {
    if (!familyId) return [];

    const snap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('documents')
      .get();

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MedicalDocument));
  }

  async getDocumentById(id: string, familyId?: string, patientId?: string): Promise<MedicalDocument | null> {
    if (!familyId) return null;

    if (patientId) {
      const doc = await this.db
        .collection('families')
        .doc(familyId)
        .collection('patients')
        .doc(patientId)
        .collection('documents')
        .doc(id)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as MedicalDocument;
      }
    }

    // Lookup across patients in this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const pDoc of patientsSnap.docs) {
      const doc = await pDoc.ref.collection('documents').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as MedicalDocument;
      }
    }

    return null;
  }

  async createDocument(data: Omit<MedicalDocument, 'id'>, familyId?: string): Promise<MedicalDocument> {
    if (!familyId) throw new Error('familyId é obrigatório');

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const doc: MedicalDocument = {
      id: docId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('documents')
      .doc(doc.id)
      .set(doc);

    return doc;
  }

  async updateDocument(
    id: string,
    data: Partial<MedicalDocument>,
    familyId?: string,
    patientId?: string
  ): Promise<MedicalDocument | null> {
    if (!familyId) throw new Error('familyId é obrigatório');

    let targetPatientId = patientId || data.patientId;
    if (!targetPatientId) {
      const existing = await this.getDocumentById(id, familyId);
      if (!existing) return null;
      targetPatientId = existing.patientId;
    }

    const ref = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('documents')
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const now = new Date().toISOString();
    await ref.update({ ...data, updatedAt: now });

    return { id, ...doc.data(), ...data, updatedAt: now } as MedicalDocument;
  }

  async deleteDocument(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId) return false;

    let targetPatientId = patientId;
    if (!targetPatientId) {
      const existing = await this.getDocumentById(id, familyId);
      if (!existing) return false;
      targetPatientId = existing.patientId;
    }

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(targetPatientId)
      .collection('documents')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // TIMELINE
  // =========================================================================

  async getTimelineEvents(
    patientId: string,
    filter?: { category?: string; type?: TimelineEventType; startDate?: string; endDate?: string },
    familyId?: string
  ): Promise<TimelineEvent[]> {
    if (!familyId) return [];

    let query: FirebaseFirestore.Query = this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('timeline');

    if (filter?.category) {
      query = query.where('category', '==', filter.category);
    }
    if (filter?.type) {
      query = query.where('type', '==', filter.type);
    }

    const snap = await query.get();
    if (snap.empty) {
      return [];
    }

    let events: TimelineEvent[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TimelineEvent));

    if (filter?.startDate) {
      events = events.filter((e) => e.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      events = events.filter((e) => e.date <= filter.endDate!);
    }

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createTimelineEvent(data: Omit<TimelineEvent, 'id'>, familyId?: string): Promise<TimelineEvent> {
    if (!familyId) throw new Error('familyId é obrigatório');

    const eventId = `tle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const event: TimelineEvent = {
      id: eventId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(data.patientId)
      .collection('timeline')
      .doc(event.id)
      .set(event);

    return event;
  }

  async deleteTimelineEvent(id: string, familyId?: string, patientId?: string): Promise<boolean> {
    if (!familyId || !patientId) return false;

    await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .doc(patientId)
      .collection('timeline')
      .doc(id)
      .delete();

    return true;
  }

  // =========================================================================
  // DATA MANAGEMENT & CLEANUP
  // =========================================================================

  async wipeFamilyHealthData(familyId: string): Promise<void> {
    if (!familyId) return;

    // 1. Fetch all patients of this family
    const patientsSnap = await this.db
      .collection('families')
      .doc(familyId)
      .collection('patients')
      .get();

    for (const patDoc of patientsSnap.docs) {
      const patRef = patDoc.ref;
      const subcollections = [
        'medications',
        'appointments',
        'exams',
        'documents',
        'timeline',
        'accesses',
      ];

      for (const sub of subcollections) {
        const subSnap = await patRef.collection(sub).get();
        if (!subSnap.empty) {
          const batch = this.db.batch();
          subSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      await patRef.delete();
    }
  }
}
