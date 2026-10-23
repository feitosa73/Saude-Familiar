import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MemoryFamilyRepository, MemoryHealthRepository } from '../server/repositories/MemoryRepositories';

describe('Gestão e Edição de Membros (Cuidadores e Visualizadores)', () => {
  it('deve criar convite com nome, telefone, papel e paciente associado', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const createdFamily = await familyRepo.createFamilyWithOwner('Família Silva', 'owner-1', 'owner@example.com', 'Carlos Silva');

    const invitation = await familyRepo.createInvitation({
      familyId: createdFamily.family.id,
      patientId: 'patient-1',
      patientName: 'Dona Francisca',
      invitedEmail: 'cuidadora@example.com',
      invitedName: 'Mariana Santos',
      invitedPhone: '(11) 98765-4321',
      role: 'CAREGIVER',
      createdBy: 'owner-1',
      tokenHash: 'hash-token-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    assert.strictEqual(invitation.invitedName, 'Mariana Santos');
    assert.strictEqual(invitation.invitedPhone, '(11) 98765-4321');
    assert.strictEqual(invitation.role, 'CAREGIVER');
    assert.strictEqual(invitation.status, 'pending');

    // Ao aceitar o convite, os dados de nome e telefone do convite devem ser propagados para o usuário
    const acceptRes = await familyRepo.acceptInvitation('hash-token-123', {
      uid: 'user-cuidadora-1',
      email: 'cuidadora@example.com',
    });

    assert.strictEqual(acceptRes.membership.userId, 'user-cuidadora-1');
    assert.strictEqual(acceptRes.patientAccess.role, 'CAREGIVER');

    const userDoc = await familyRepo.getUser('user-cuidadora-1');
    assert.strictEqual(userDoc?.displayName, 'Mariana Santos');
    assert.strictEqual(userDoc?.phone, '(11) 98765-4321');
  });

  it('deve listar membros da família com telefone e detalhes de acesso aos pacientes', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const createdFamily = await familyRepo.createFamilyWithOwner('Família Oliveira', 'owner-2', 'carlos@example.com', 'Carlos');

    await familyRepo.saveUser({
      id: 'member-1',
      email: 'membro@example.com',
      displayName: 'João Silva',
      phone: '(21) 99999-8888',
      familyId: createdFamily.family.id,
    });
    await familyRepo.saveMembership({
      id: 'mem-1',
      familyId: createdFamily.family.id,
      userId: 'member-1',
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: 'owner-2',
    });
    await familyRepo.grantMemberPatientAccess(createdFamily.family.id, 'member-1', 'pat-1', 'VIEWER');

    const membersWithAccess = await familyRepo.listFamilyMembersWithAccess(createdFamily.family.id);
    const member = membersWithAccess.find((m) => m.userId === 'member-1');

    assert.ok(member);
    assert.strictEqual(member.name, 'João Silva');
    assert.strictEqual(member.phone, '(21) 99999-8888');
    assert.strictEqual(member.patientAccesses.length, 1);
    assert.strictEqual(member.patientAccesses[0].role, 'VIEWER');
  });

  it('deve permitir editar nome e telefone de um membro existente', async () => {
    const familyRepo = new MemoryFamilyRepository();
    const createdFamily = await familyRepo.createFamilyWithOwner('Família Santos', 'owner-3', 'owner3@example.com', 'Admin');

    await familyRepo.saveUser({
      id: 'member-2',
      email: 'roberta@example.com',
      displayName: 'Roberta Antiga',
      phone: '(11) 1111-1111',
      familyId: createdFamily.family.id,
    });
    await familyRepo.saveMembership({
      id: 'mem-2',
      familyId: createdFamily.family.id,
      userId: 'member-2',
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: 'owner-3',
    });

    await familyRepo.updateFamilyMemberDetails(createdFamily.family.id, 'member-2', {
      name: 'Roberta Nova Santos',
      phone: '(11) 98888-7777',
    });

    const userDoc = await familyRepo.getUser('member-2');
    assert.strictEqual(userDoc?.displayName, 'Roberta Nova Santos');
    assert.strictEqual(userDoc?.phone, '(11) 98888-7777');
  });
});
