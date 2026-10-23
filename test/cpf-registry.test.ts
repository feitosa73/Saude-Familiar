import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { CpfDuplicateError, hashCpf, normalizeCpf } from '../server/utils/cpf';

// Mathematically verified synthetic CPFs from test/cpf.test.ts
const SYNTHETIC_CPF_1 = '12345678909'; // DV 09
const SYNTHETIC_CPF_2 = '99900000188'; // DV 88
const SYNTHETIC_CPF_3 = '88877766603'; // DV 03
const INVALID_FORMAT_CPF = '123.456.789-00';

describe('Entrega 2: CPF Registry & Global Uniqueness', () => {
  it('should register a patient with valid CPF and store in cpfRegistry', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const patient = await healthRepo.createPatient({
      name: 'Paciente Teste 1',
      birthDate: '1980-05-10',
      bloodType: 'O+',
      allergies: [],
      emergencyContacts: [],
      cpf: SYNTHETIC_CPF_1,
    });

    assert.ok(patient.id);
    assert.strictEqual(patient.cpfMasked, '***.***.***-09');
    assert.ok(patient.cpfHash);

    // Verify registry record
    const regRecord = await familyRepo.findCpfRecord(patient.cpfHash!);
    assert.ok(regRecord);
    assert.strictEqual(regRecord.entityType, 'patient');
    assert.strictEqual(regRecord.entityId, patient.id);
  });

  it('should reject creating a second patient with duplicate CPF (CpfDuplicateError)', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    await healthRepo.createPatient({
      name: 'Paciente Original',
      birthDate: '1980-05-10',
      bloodType: 'O+',
      allergies: [],
      emergencyContacts: [],
      cpf: SYNTHETIC_CPF_1,
    });

    await assert.rejects(
      async () => {
        await healthRepo.createPatient({
          name: 'Paciente Duplicado',
          birthDate: '1990-01-01',
          bloodType: 'A+',
          allergies: [],
          emergencyContacts: [],
          cpf: SYNTHETIC_CPF_1,
        });
      },
      (err: any) => {
        assert.ok(err instanceof CpfDuplicateError || err.code === 'CPF_ALREADY_EXISTS');
        return true;
      }
    );
  });

  it('should allow creating a patient if the CPF is already assigned to a User (same physical person as user and patient)', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Register User with SYNTHETIC_CPF_1
    await familyRepo.saveUser({
      id: 'user-cuidador-1',
      email: 'cuidador1@teste.com',
      displayName: 'Cuidador Teste',
      cpf: SYNTHETIC_CPF_1,
    });

    // Creating a Patient with the same CPF must be allowed (dual entity: same person)
    const patient = await healthRepo.createPatient({
      name: 'Paciente com CPF do Cuidador',
      birthDate: '1975-03-20',
      bloodType: 'B+',
      allergies: [],
      emergencyContacts: [],
      cpf: SYNTHETIC_CPF_1,
    });

    assert.ok(patient.id);
    const regRecord = await familyRepo.findCpfRecord(patient.cpfHash!);
    assert.ok(regRecord);
    assert.strictEqual(regRecord.userId, 'user-cuidador-1');
    assert.strictEqual(regRecord.patientId, patient.id);

    // But creating a SECOND patient with the same CPF must be blocked
    await assert.rejects(
      async () => {
        await healthRepo.createPatient({
          name: 'Segundo Paciente Duplicado',
          birthDate: '1976-04-10',
          bloodType: 'O+',
          allergies: [],
          emergencyContacts: [],
          cpf: SYNTHETIC_CPF_1,
        });
      },
      (err: any) => {
        assert.ok(err instanceof CpfDuplicateError || err.code === 'CPF_ALREADY_EXISTS');
        return true;
      }
    );
  });

  it('should allow saving a user if the CPF is already assigned to a Patient', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const patient = await healthRepo.createPatient({
      name: 'Paciente Teste 2',
      birthDate: '1982-11-15',
      bloodType: 'AB+',
      allergies: [],
      emergencyContacts: [],
      cpf: SYNTHETIC_CPF_2,
    });

    // Saving a User with the same CPF must be allowed (same person as user and patient)
    await familyRepo.saveUser({
      id: 'user-visualizador-2',
      email: 'viewer2@teste.com',
      displayName: 'Visualizador Teste',
      cpf: SYNTHETIC_CPF_2,
    });

    const regRecord = await familyRepo.findCpfRecord(patient.cpfHash!);
    assert.ok(regRecord);
    assert.strictEqual(regRecord.patientId, patient.id);
    assert.strictEqual(regRecord.userId, 'user-visualizador-2');

    // But saving a SECOND user with the same CPF must be blocked
    await assert.rejects(
      async () => {
        await familyRepo.saveUser({
          id: 'user-outro-3',
          email: 'outro3@teste.com',
          displayName: 'Outro Usuario Duplicado',
          cpf: SYNTHETIC_CPF_2,
        });
      },
      (err: any) => {
        assert.ok(err instanceof CpfDuplicateError || err.code === 'CPF_ALREADY_EXISTS');
        return true;
      }
    );
  });

  it('should handle concurrent registrations gracefully, allowing only 1 to succeed', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const attempts = [
      healthRepo.createPatient({
        name: 'Concorrente A',
        birthDate: '1990-01-01',
        bloodType: 'O+',
        allergies: [],
        emergencyContacts: [],
        cpf: SYNTHETIC_CPF_3,
      }),
      healthRepo.createPatient({
        name: 'Concorrente B',
        birthDate: '1991-02-02',
        bloodType: 'A+',
        allergies: [],
        emergencyContacts: [],
        cpf: SYNTHETIC_CPF_3,
      }),
    ];

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent attempt should succeed');
    assert.strictEqual(rejected.length, 1, 'The duplicate concurrent attempt should be rejected');
  });

  it('should release CPF from registry upon patient deletion', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const patient = await healthRepo.createPatient({
      name: 'Paciente Para Deletar',
      birthDate: '1960-06-06',
      bloodType: 'O-',
      allergies: [],
      emergencyContacts: [],
      cpf: SYNTHETIC_CPF_1,
    });

    const hash = patient.cpfHash!;
    assert.ok(await familyRepo.findCpfRecord(hash));

    // Delete patient
    const deleted = await healthRepo.deletePatient(patient.id);
    assert.strictEqual(deleted, true);

    // Registry record must now be released
    const releasedRecord = await familyRepo.findCpfRecord(hash);
    assert.strictEqual(releasedRecord, null);

    // Now the same CPF can be registered again without conflict
    const newPatient = await healthRepo.createPatient({
      name: 'Novo Paciente Reusando CPF',
      birthDate: '1995-12-12',
      bloodType: 'A-',
      allergies: [],
      emergencyContacts: [],
      cpf: SYNTHETIC_CPF_1,
    });

    assert.ok(newPatient.id);
    assert.strictEqual(newPatient.cpfMasked, '***.***.***-09');
  });

  it('should preserve compatibility with legacy records without CPF', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    // Legacy patient creation without CPF
    const legacyPatient = await healthRepo.createPatient({
      name: 'Paciente Legado Sem CPF',
      birthDate: '1955-04-12',
      bloodType: 'B-',
      allergies: [],
      emergencyContacts: [],
    });

    assert.ok(legacyPatient.id);
    assert.strictEqual(legacyPatient.cpfMasked, undefined);
    assert.strictEqual(legacyPatient.cpfHash, undefined);

    // Update other fields without touching CPF
    const updated = await healthRepo.updatePatient(legacyPatient.id, {
      bloodType: 'B+',
      notes: 'Atualização de prontuário clínico legado',
    });

    assert.strictEqual(updated?.bloodType, 'B+');
    assert.strictEqual(updated?.cpfMasked, undefined);
    assert.strictEqual(updated?.cpfHash, undefined);
  });

  it('should release previous CPF hash when updating patient to a new CPF', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    const patient = await healthRepo.createPatient({
      name: 'Paciente Para Alterar CPF',
      birthDate: '1970-07-07',
      bloodType: 'O+',
      allergies: [],
      emergencyContacts: [],
      cpf: SYNTHETIC_CPF_1,
    });

    const oldHash = patient.cpfHash!;
    assert.ok(await familyRepo.findCpfRecord(oldHash));

    // Update to SYNTHETIC_CPF_2
    const updated = await healthRepo.updatePatient(patient.id, {
      cpf: SYNTHETIC_CPF_2,
    });

    assert.strictEqual(updated?.cpfMasked, '***.***.***-88');
    const newHash = hashCpf(normalizeCpf(SYNTHETIC_CPF_2));

    // Old hash should be gone
    assert.strictEqual(await familyRepo.findCpfRecord(oldHash), null);
    // New hash should be registered
    const newRecord = await familyRepo.findCpfRecord(newHash);
    assert.ok(newRecord);
    assert.strictEqual(newRecord.entityId, patient.id);
  });

  it('should reject invalid CPF format when creating patient', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);

    await assert.rejects(
      async () => {
        await healthRepo.createPatient({
          name: 'Paciente CPF Inválido',
          birthDate: '1980-01-01',
          bloodType: 'O+',
          allergies: [],
          emergencyContacts: [],
          cpf: INVALID_FORMAT_CPF,
        });
      },
      /inválido/i
    );
  });
});
