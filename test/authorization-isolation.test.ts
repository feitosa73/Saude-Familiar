import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';
import { ServerAuthorizationService } from '../server/services/authorizationService';
import { authorizationService as clientAuthzService } from '../src/services/authorizationService';

describe('Prioridade 2: Permissões e Isolamento de Dados por Perfil', () => {
  it('1. ADMIN (Responsável/Titular): deve ter permissão total (leitura, edição, exclusão e gestão de acesso)', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const authz = new ServerAuthorizationService(healthRepo);

    // Concede acesso ADMIN
    await healthRepo.createPatientAccess({
      userId: 'user-admin',
      patientId: 'pat-1',
      role: 'ADMIN',
      createdBy: 'system',
    });

    assert.strictEqual(await authz.canViewPatient('user-admin', 'pat-1'), true);
    assert.strictEqual(await authz.canEditPatient('user-admin', 'pat-1'), true);
    assert.strictEqual(await authz.canDeletePatient('user-admin', 'pat-1'), true);
    assert.strictEqual(await authz.canCreateRecord('user-admin', 'pat-1'), true);
    assert.strictEqual(await authz.canEditRecord('user-admin', 'pat-1'), true);
    assert.strictEqual(await authz.canDeleteRecord('user-admin', 'pat-1'), true);
    assert.strictEqual(await authz.canManageAccess('user-admin', 'pat-1'), true);

    // Verificação no serviço client-side
    const clientPerms = clientAuthzService.getPermissions('ADMIN');
    assert.strictEqual(clientPerms.canView, true);
    assert.strictEqual(clientPerms.canEditPatient, true);
    assert.strictEqual(clientPerms.canDeletePatient, true);
    assert.strictEqual(clientPerms.canCreateRecord, true);
    assert.strictEqual(clientPerms.canEditRecord, true);
    assert.strictEqual(clientPerms.canDeleteRecord, true);
    assert.strictEqual(clientPerms.canManageAccess, true);
    assert.strictEqual(clientPerms.canAdministerMedication, true);
  });

  it('2. CAREGIVER (Cuidador Designado): pode administrar medicações e registrar exames, mas NÃO pode excluir paciente ou gerenciar acessos', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const authz = new ServerAuthorizationService(healthRepo);

    // Concede acesso CAREGIVER
    await healthRepo.createPatientAccess({
      userId: 'user-caregiver',
      patientId: 'pat-1',
      role: 'CAREGIVER',
      createdBy: 'user-admin',
    });

    assert.strictEqual(await authz.canViewPatient('user-caregiver', 'pat-1'), true);
    assert.strictEqual(await authz.canCreateRecord('user-caregiver', 'pat-1'), true);
    assert.strictEqual(await authz.canEditRecord('user-caregiver', 'pat-1'), true);

    // Limites de permissão do cuidador
    assert.strictEqual(await authz.canEditPatient('user-caregiver', 'pat-1'), false);
    assert.strictEqual(await authz.canDeletePatient('user-caregiver', 'pat-1'), false);
    assert.strictEqual(await authz.canDeleteRecord('user-caregiver', 'pat-1'), false);
    assert.strictEqual(await authz.canManageAccess('user-caregiver', 'pat-1'), false);

    // Verificação no serviço client-side
    const clientPerms = clientAuthzService.getPermissions('CAREGIVER');
    assert.strictEqual(clientPerms.canView, true);
    assert.strictEqual(clientPerms.canAdministerMedication, true);
    assert.strictEqual(clientPerms.canCreateRecord, true);
    assert.strictEqual(clientPerms.canEditRecord, true);
    assert.strictEqual(clientPerms.canDeleteRecord, false);
    assert.strictEqual(clientPerms.canEditPatient, false);
    assert.strictEqual(clientPerms.canDeletePatient, false);
    assert.strictEqual(clientPerms.canManageAccess, false);
  });

  it('3. VIEWER (Familiar Apoio/Leitura): acesso estritamente de visualização; bloqueado para administrar medicamentos e editar dados clínicos', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const authz = new ServerAuthorizationService(healthRepo);

    // Concede acesso VIEWER
    await healthRepo.createPatientAccess({
      userId: 'user-viewer',
      patientId: 'pat-1',
      role: 'VIEWER',
      createdBy: 'user-admin',
    });

    assert.strictEqual(await authz.canViewPatient('user-viewer', 'pat-1'), true);

    // Bloqueios de escrita do visualizador
    assert.strictEqual(await authz.canCreateRecord('user-viewer', 'pat-1'), false);
    assert.strictEqual(await authz.canEditRecord('user-viewer', 'pat-1'), false);
    assert.strictEqual(await authz.canDeleteRecord('user-viewer', 'pat-1'), false);
    assert.strictEqual(await authz.canEditPatient('user-viewer', 'pat-1'), false);
    assert.strictEqual(await authz.canDeletePatient('user-viewer', 'pat-1'), false);
    assert.strictEqual(await authz.canManageAccess('user-viewer', 'pat-1'), false);

    // Verificação no serviço client-side
    const clientPerms = clientAuthzService.getPermissions('VIEWER');
    assert.strictEqual(clientPerms.canView, true);
    assert.strictEqual(clientPerms.canAdministerMedication, false);
    assert.strictEqual(clientPerms.canCreateRecord, false);
    assert.strictEqual(clientPerms.canEditRecord, false);
    assert.strictEqual(clientPerms.canDeleteRecord, false);
    assert.strictEqual(clientPerms.canEditPatient, false);
    assert.strictEqual(clientPerms.canDeletePatient, false);
    assert.strictEqual(clientPerms.canManageAccess, false);
  });

  it('4. Isolamento de dados entre pacientes e famílias distintas', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const healthRepo = new MemoryHealthRepository(familyRepo);
    const authz = new ServerAuthorizationService(healthRepo);

    // Usuário X tem acesso somente ao Paciente 1
    await healthRepo.createPatientAccess({
      userId: 'user-x',
      patientId: 'pat-1',
      role: 'CAREGIVER',
      createdBy: 'system',
    });

    // Paciente 2 pertence a outra família/contexto sem vínculo com Usuário X
    assert.strictEqual(await authz.canViewPatient('user-x', 'pat-1'), true);
    assert.strictEqual(await authz.canViewPatient('user-x', 'pat-2'), false);
    assert.strictEqual(await authz.canCreateRecord('user-x', 'pat-2'), false);
  });
});
