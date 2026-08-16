import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { IHealthRepository } from '../repositories/IRepository';
import { FirestoreHealthRepository } from '../repositories/FirestoreHealthRepository';
import { IFamilyRepository } from '../repositories/IFamilyRepository';
import { FirestoreFamilyRepository } from '../repositories/FirestoreFamilyRepository';
import { TimelineEventType, PatientRole, UserMeResponse } from '../types';
import { ServerAuthorizationService } from '../services/authorizationService';
import { requireAuth, AuthenticatedRequest } from '../middlewares/requireAuth';
import {
  requireActiveMembership,
  AuthorizedFamilyRequest,
} from '../middlewares/requireActiveMembership';
import { requireFamilyOwner } from '../middlewares/requireFamilyOwner';

export function createApiRouter(
  repository: IHealthRepository = new FirestoreHealthRepository(),
  familyRepository: IFamilyRepository = new FirestoreFamilyRepository()
): Router {
  const router = Router();
  const authzService = new ServerAuthorizationService(repository);

  // 1. Basic Token & Identity verification
  router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
    }

    res.json({
      uid: authUser.uid,
      email: authUser.email || null,
      authenticated: true,
    });
  });

  // 2. Authoritative User Identity + Membership from Firestore
  router.get('/user/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.user;
      if (!authUser?.uid) {
        return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
      }

      // Check requested family from header or query
      const requestedFamilyId =
        (req.headers['x-family-id'] as string) ||
        (req.query.familyId as string) ||
        undefined;

      // Lookup all memberships for this user
      const allMemberships = await familyRepository.listMembershipsByUserId(authUser.uid);
      const userFamiliesList: Array<{ family: any; membership: any }> = [];

      for (const mem of allMemberships) {
        const fam = await familyRepository.getFamily(mem.familyId);
        if (fam) {
          userFamiliesList.push({ family: fam, membership: mem });
        }
      }

      // Selected active membership
      let activeMembership = await familyRepository.findMembershipByUserId(
        authUser.uid,
        requestedFamilyId
      );
      let activeFamily = null;

      if (activeMembership) {
        activeFamily = await familyRepository.getFamily(activeMembership.familyId);
      } else if (userFamiliesList.length > 0) {
        activeMembership = userFamiliesList[0].membership;
        activeFamily = userFamiliesList[0].family;
      }

      // Sync user profile in Firestore 'users' collection (best-effort sync)
      if (authUser.email) {
        try {
          await familyRepository.saveUser({
            id: authUser.uid,
            email: authUser.email.trim().toLowerCase(),
            displayName: (authUser as any).name || null,
            familyId: activeFamily?.id || undefined,
            updatedAt: new Date().toISOString(),
          });
        } catch (err: any) {
          if (err?.code !== 7 && err?.code !== 'PERMISSION_DENIED') {
            console.warn('[API] /user/me: Error syncing user doc in Firestore:', err?.code || err?.message);
          }
        }
      }

      // Calculate pending requests count if owner
      const pendingRequestsCount = await familyRepository.countPendingRequestsForOwner(authUser.uid);

      const response: UserMeResponse = {
        uid: authUser.uid,
        email: authUser.email || null,
        displayName: (authUser as any).name || null,
        photoURL: (authUser as any).picture || null,
        family: activeFamily,
        membership: activeMembership,
        families: userFamiliesList,
        pendingRequestsCount,
      };

      res.json(response);
    } catch (error: any) {
      const isFirestoreUnavailable =
        error?.message?.includes('Cloud Firestore API has not been used') ||
        error?.message?.includes('PERMISSION_DENIED') ||
        error?.code === 7 ||
        error?.code === 'PERMISSION_DENIED';

      if (isFirestoreUnavailable) {
        console.error('[API] /user/me: Erro de permissão IAM ou API desabilitada no Firestore:', error?.code || error?.message);
        return res.status(503).json({
          error:
            'Acesso ao Firestore não autorizado ou serviço indisponível. Verifique as permissões IAM da Service Account.',
          code: 'FIRESTORE_PERMISSION_DENIED',
        });
      }

      console.error('[API] Error fetching /user/me:', error);
      res.status(500).json({
        error: 'Erro interno ao consultar perfil e associação do usuário',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  // 2.1 Create Family (Onboarding or additional family for authenticated user)
  router.post('/families', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.user;
      if (!authUser?.uid) {
        return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
      }

      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Nome da família é obrigatório' });
      }

      const { family, membership } = await familyRepository.createFamilyWithOwner(
        name.trim(),
        authUser.uid,
        authUser.email,
        (authUser as any).name || null
      );

      res.status(201).json({
        family,
        membership,
      });
    } catch (error: any) {
      console.error('[API] Erro ao criar família:', error);
      res.status(500).json({
        error: error.message || 'Erro ao criar família',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  // =========================================================================
  // 2.2 ACCESS REQUESTS ENDPOINTS (Request access, list, approve, reject)
  // =========================================================================

  // Solicitante envia pedido de acesso informando e-mail do owner da família
  router.post('/access-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.user;
      if (!authUser?.uid) {
        return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
      }

      const { ownerEmail } = req.body;
      if (!ownerEmail || typeof ownerEmail !== 'string' || !ownerEmail.trim()) {
        return res.status(400).json({ error: 'E-mail do responsável é obrigatório.' });
      }

      const cleanOwnerEmail = ownerEmail.trim().toLowerCase();
      const requesterEmail = (authUser.email || '').trim().toLowerCase();
      const requesterName = (authUser as any).name || authUser.email?.split('@')[0] || 'Usuário';

      // Validação básica de auto-solicitação
      if (requesterEmail && cleanOwnerEmail === requesterEmail) {
        return res.status(400).json({
          error: 'Você já é o usuário titular desta conta. Para compartilhar pacientes, informe o e-mail de outro responsável familiar.',
          code: 'SELF_REQUEST_NOT_ALLOWED',
        });
      }

      // Localiza o usuário owner pelo e-mail server-side
      const ownerUser = await familyRepository.findUserByEmail(cleanOwnerEmail);

      if (!ownerUser) {
        console.log(`[API] AccessRequest: Email de responsável ${cleanOwnerEmail} não encontrado.`);
        return res.status(404).json({
          error: `Nenhum responsável familiar cadastrado com o e-mail "${cleanOwnerEmail}". Verifique se o endereço está correto e se o responsável já acessou o Saúde Familiar.`,
          code: 'OWNER_NOT_FOUND',
        });
      }

      // Localiza a família em que o usuário é owner
      let targetFamilyId = ownerUser.familyId;

      if (!targetFamilyId) {
        const ownerMemberships = await familyRepository.listMembershipsByUserId(ownerUser.id);
        const ownerFam = ownerMemberships.find((m) => m.role === 'owner');
        if (ownerFam) {
          targetFamilyId = ownerFam.familyId;
        }
      }

      if (!targetFamilyId) {
        console.log(`[API] AccessRequest: Owner ${ownerUser.id} não possui família vinculada.`);
        return res.status(404).json({
          error: `O responsável cadastrado (${cleanOwnerEmail}) ainda não possui uma família criada no sistema.`,
          code: 'FAMILY_NOT_FOUND',
        });
      }

      // Verifica se o solicitante já possui membership nessa família
      const existingMembership = await familyRepository.getMembership(targetFamilyId, authUser.uid);
      if (existingMembership && existingMembership.status === 'active') {
        return res.status(400).json({
          error: 'Você já possui acesso ativo a esta família.',
          code: 'ALREADY_MEMBER',
        });
      }

      // Verifica se já existe solicitação pendente para essa família
      const pendingReqs = await familyRepository.listAccessRequestsByFamily(targetFamilyId, 'pending');
      const alreadyPending = pendingReqs.some((r) => r.requesterUid === authUser.uid);

      if (alreadyPending) {
        return res.status(400).json({
          error: 'Sua solicitação de acesso já está pendente de aprovação pelo responsável.',
          code: 'ALREADY_PENDING',
        });
      }

      // Obtém dados da família
      const family = await familyRepository.getFamily(targetFamilyId);

      // Cria a solicitação pendente no Firestore
      const newRequest = await familyRepository.createAccessRequest({
        familyId: targetFamilyId,
        familyName: family?.name || 'Família',
        requesterUid: authUser.uid,
        requesterEmail: authUser.email || '',
        requesterName: requesterName,
        ownerUid: ownerUser.id,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null,
      });

      console.log(`[API] Solicitação de acesso criada (${newRequest.id}) de ${authUser.uid} para família ${targetFamilyId}`);

      return res.status(201).json({
        success: true,
        message: 'Solicitação de acesso enviada com sucesso! Aguardando aprovação do responsável.',
        request: newRequest,
      });
    } catch (error: any) {
      console.error('[API] Erro ao criar solicitação de acesso:', error?.code || error?.message);
      res.status(500).json({
        error: 'Não foi possível gravar a solicitação no Firestore. Verifique a conectividade e permissões do banco.',
        code: 'FIRESTORE_WRITE_FAILED',
      });
    }
  });

  // Lista solicitações feitas pelo usuário autenticado
  router.get('/access-requests/my', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.user;
      if (!authUser?.uid) {
        return res.status(401).json({ error: 'Unauthorized: Usuário não autenticado' });
      }

      const requests = await familyRepository.listAccessRequestsByRequester(authUser.uid);
      res.json(requests);
    } catch (error: any) {
      console.error('[API] Erro ao listar solicitações do usuário:', error);
      res.status(500).json({ error: 'Erro ao buscar solicitações' });
    }
  });

  // Lista solicitações de acesso recebidas pela família (somente Owner)
  router.get(
    '/families/:familyId/access-requests',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.params.familyId;
        const requests = await familyRepository.listAccessRequestsByFamily(familyId);
        res.json(requests);
      } catch (error: any) {
        console.error('[API] Erro ao listar solicitações da família:', error);
        res.status(500).json({ error: 'Erro ao listar solicitações da família' });
      }
    }
  );

  // Aprovar solicitação de acesso (somente Owner)
  router.post(
    '/families/:familyId/access-requests/:requestId/approve',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const { familyId, requestId } = req.params;
        const { patientId, role } = req.body;
        const ownerUid = req.user!.uid;

        if (!patientId || typeof patientId !== 'string') {
          return res.status(400).json({ error: 'Selecione o paciente ao qual conceder acesso.' });
        }

        if (role !== 'VIEWER' && role !== 'CAREGIVER') {
          return res.status(400).json({
            error: 'Papel inválido. Apenas Visualizador(a) (VIEWER) ou Cuidador(a) (CAREGIVER) são permitidos.',
          });
        }

        // Valida que o paciente existe e pertence a esta família
        const patient = await repository.getPatientById(patientId, familyId);
        if (!patient) {
          return res.status(404).json({ error: 'Paciente não encontrado nesta família.' });
        }

        const result = await familyRepository.approveAccessRequest(
          familyId,
          requestId,
          ownerUid,
          patientId,
          role,
          patient.name
        );

        // Também garante registro no repositório clínico se necessário
        try {
          await repository.createPatientAccess(
            {
              patientId,
              userId: result.request.requesterUid,
              role: role,
              createdBy: ownerUid,
            },
            familyId
          );
        } catch (e) {
          // Ignora se já tiver sido criado no batch
        }

        res.json({
          success: true,
          message: `Acesso aprovado com sucesso para ${result.request.requesterName} no paciente ${patient.name} (${role === 'VIEWER' ? 'Visualizador(a)' : 'Cuidador(a)'}).`,
          ...result,
        });
      } catch (error: any) {
        console.error('[API] Erro ao aprovar solicitação:', error);
        res.status(500).json({ error: error.message || 'Erro ao aprovar solicitação' });
      }
    }
  );

  // Rejeitar solicitação de acesso (somente Owner)
  router.post(
    '/families/:familyId/access-requests/:requestId/reject',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const { familyId, requestId } = req.params;
        const ownerUid = req.user!.uid;

        const updated = await familyRepository.rejectAccessRequest(familyId, requestId, ownerUid);

        res.json({
          success: true,
          message: 'Solicitação de acesso rejeitada.',
          request: updated,
        });
      } catch (error: any) {
        console.error('[API] Erro ao rejeitar solicitação:', error);
        res.status(500).json({ error: error.message || 'Erro ao rejeitar solicitação' });
      }
    }
  );

  // ==========================================
  // FAMILY INVITATIONS (CONVITE DE FAMILIAR)
  // ==========================================

  // 1. Criar novo convite para familiar/cuidador (somente Owner)
  router.post(
    '/invitations',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const ownerUid = req.user!.uid;
        const familyId = req.membership!.familyId;
        const { patientId, invitedEmail, role } = req.body;

        if (!patientId || typeof patientId !== 'string' || !patientId.trim()) {
          return res.status(400).json({
            error: 'Selecione o paciente para o qual o convite será emitido.',
            code: 'PATIENT_REQUIRED',
          });
        }

        if (!invitedEmail || typeof invitedEmail !== 'string' || !invitedEmail.includes('@')) {
          return res.status(400).json({
            error: 'Informe um endereço de e-mail válido para o convidado.',
            code: 'INVALID_EMAIL',
          });
        }

        const cleanEmail = invitedEmail.trim().toLowerCase();

        // Strict Role Check: Only VIEWER or CAREGIVER are permitted. OWNER is forbidden via invitation.
        if (role !== 'VIEWER' && role !== 'CAREGIVER') {
          return res.status(400).json({
            error: 'Papel inválido. Apenas Visualizador(a) (VIEWER) ou Cuidador(a) (CAREGIVER) podem ser atribuídos por convite.',
            code: 'INVALID_ROLE',
          });
        }

        // Validate that patient exists and belongs to this family
        const patient = await repository.getPatientById(patientId, familyId);
        if (!patient) {
          return res.status(404).json({
            error: 'Paciente não encontrado nesta família.',
            code: 'PATIENT_NOT_FOUND',
          });
        }

        // Check if there is already an active pending invitation for this (family, patient, email)
        const existingPending = await familyRepository.findPendingInvitation(
          familyId,
          patientId,
          cleanEmail
        );
        if (existingPending) {
          try {
            await familyRepository.revokeInvitation(familyId, existingPending.id, ownerUid);
          } catch (_) {}
        }

        // Generate cryptographically secure random token (32 bytes = 64 hex characters)
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const invitation = await familyRepository.createInvitation({
          familyId,
          patientId,
          patientName: patient.name,
          invitedEmail: cleanEmail,
          role,
          createdBy: ownerUid,
          tokenHash,
          expiresAt,
        });

        // Build invitation URL and friendly share message
        const host = req.get('host') || 'saudefamiliar.fiqueok.com.br';
        const protocol = req.protocol === 'http' && host.includes('localhost') ? 'http' : 'https';
        const inviteUrl = `${protocol}://${host}/invite/${rawToken}`;
        const shareMessage = `Você foi convidado(a) para acessar informações de saúde compartilhadas de ${patient.name} no Saúde Familiar.\nAcesse o link abaixo e entre com o e-mail convidado (${cleanEmail}):\n${inviteUrl}`;

        // Return raw token to frontend once, omit tokenHash from response
        const { tokenHash: _, ...safeInvitation } = invitation;

        return res.status(201).json({
          success: true,
          invitation: safeInvitation,
          token: rawToken,
          inviteUrl,
          shareMessage,
        });
      } catch (error: any) {
        console.error('[API] Erro ao criar convite:', error);
        return res.status(500).json({
          error: error.message || 'Erro ao gerar convite no sistema.',
          code: 'CREATE_INVITATION_FAILED',
        });
      }
    }
  );

  // 2. Listar convites da família (somente Owner)
  router.get(
    '/invitations',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const invitations = await familyRepository.listInvitations(familyId);

        // Sanitize: strip tokenHash from all returned items
        const sanitized = invitations.map(({ tokenHash, ...rest }) => rest);
        return res.json(sanitized);
      } catch (error: any) {
        console.error('[API] Erro ao listar convites:', error);
        return res.status(500).json({
          error: 'Erro ao listar convites da família.',
          code: 'LIST_INVITATIONS_FAILED',
        });
      }
    }
  );

  // 3. Revogar convite (somente Owner)
  router.post(
    '/invitations/:id/revoke',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const invitationId = req.params.id;
        const ownerUid = req.user!.uid;

        const updated = await familyRepository.revokeInvitation(
          familyId,
          invitationId,
          ownerUid
        );

        const { tokenHash: _, ...safe } = updated;
        return res.json({
          success: true,
          message: 'Convite revogado com sucesso.',
          invitation: safe,
        });
      } catch (error: any) {
        console.error('[API] Erro ao revogar convite:', error);
        return res.status(400).json({
          error: error.message || 'Não foi possível revogar o convite.',
          code: 'REVOKE_FAILED',
        });
      }
    }
  );

  // 4. Informações públicas do convite (Sem expor dados clínicos antes da autenticação)
  router.get('/invitations/info/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: 'Token não fornecido.' });
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const invitation = await familyRepository.getInvitationByTokenHash(tokenHash);

      if (!invitation) {
        return res.status(404).json({
          valid: false,
          status: 'not_found',
          message: 'Convite não encontrado ou link inválido.',
        });
      }

      if (invitation.status === 'revoked') {
        return res.status(410).json({
          valid: false,
          status: 'revoked',
          message: 'Este convite foi revogado pelo administrador da família.',
        });
      }

      if (invitation.status === 'accepted') {
        return res.status(410).json({
          valid: false,
          status: 'accepted',
          message: 'Este convite já foi aceito e utilizado anteriormente.',
        });
      }

      const nowTime = new Date().getTime();
      if (new Date(invitation.expiresAt).getTime() <= nowTime) {
        return res.status(410).json({
          valid: false,
          status: 'expired',
          message: 'Este convite expirou (validade de 7 dias ultrapassada).',
        });
      }

      // Mask email for privacy (e.g. ro***@gmail.com)
      const [emailUser, emailDomain] = invitation.invitedEmail.split('@');
      let maskedEmail = invitation.invitedEmail;
      if (emailDomain && emailUser) {
        maskedEmail =
          emailUser.length <= 2
            ? `${emailUser[0]}***@${emailDomain}`
            : `${emailUser.slice(0, 2)}***${emailUser.slice(-1)}@${emailDomain}`;
      }

      // Never return clinical data, patient diagnoses, medications, or full patient profiles
      return res.json({
        valid: true,
        status: 'pending',
        invitedEmailMasked: maskedEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      });
    } catch (error: any) {
      console.error('[API] Erro ao consultar info do convite:', error);
      return res.status(500).json({
        valid: false,
        message: 'Erro ao consultar status do convite.',
      });
    }
  });

  // 5. Aceitar convite autenticado (Garante casamento de e-mail e operações atômicas)
  router.post('/invitations/accept', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.user;
      if (!authUser?.uid) {
        return res.status(401).json({
          error: 'Unauthorized: Usuário não autenticado',
          code: 'UNAUTHENTICATED',
        });
      }

      const { token } = req.body;
      if (!token || typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({
          error: 'Token do convite é obrigatório.',
          code: 'TOKEN_REQUIRED',
        });
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

      const result = await familyRepository.acceptInvitation(tokenHash, {
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: (authUser as any).name || authUser.email?.split('@')[0],
      });

      return res.json({
        success: true,
        message: 'Convite aceito com sucesso! Seu acesso ao paciente foi configurado.',
        familyId: result.invitation.familyId,
        patientId: result.invitation.patientId,
        patientName: result.invitation.patientName,
        role: result.invitation.role,
      });
    } catch (err: any) {
      console.error('[API] Erro ao aceitar convite:', err);
      if (err.code === 'EMAIL_MISMATCH') {
        return res.status(403).json({
          error: err.message,
          code: 'EMAIL_MISMATCH',
        });
      }
      return res.status(400).json({
        error: err.message || 'Não foi possível aceitar o convite.',
        code: err.code || 'ACCEPT_INVITATION_FAILED',
      });
    }
  });

  // Helper for current user ID context in clinical services
  const getCurrentUserId = (req: Request): string => {
    const authUser = (req as AuthenticatedRequest).user;
    return authUser?.uid || '';
  };

  // 3. Family Members Management (Administrative / Memberships)
  router.get(
    '/family/members',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const members = await familyRepository.listMemberships(familyId);
        res.json(members);
      } catch (error) {
        console.error('[API] Erro ao listar membros da família:', error);
        res.status(500).json({ error: 'Erro ao listar membros da família' });
      }
    }
  );

  router.put(
    '/family/members/:memberUid',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const { memberUid } = req.params;
        const { role, status } = req.body;
        const familyId = req.membership!.familyId;

        const existing = await familyRepository.getMembership(familyId, memberUid);
        if (!existing) {
          return res.status(404).json({ error: 'Membro não encontrado na família' });
        }

        const updated = {
          ...existing,
          role: role || existing.role,
          status: status || existing.status,
          updatedAt: new Date().toISOString(),
        };

        await familyRepository.saveMembership(updated);
        res.json(updated);
      } catch (error) {
        console.error('[API] Erro ao atualizar membro da família:', error);
        res.status(500).json({ error: 'Erro ao atualizar membro' });
      }
    }
  );

  // 4. Patient Access Management Routes (Protected by Auth & Active Membership)
  router.get(
    '/patients/:patientId/access',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canView = await authzService.canViewPatient(userId, patientId, familyId);
        if (!canView && req.membership?.role !== 'owner') {
          return res.status(403).json({ error: 'Acesso negado para este paciente' });
        }

        const accesses = await repository.getPatientAccesses(patientId, undefined, familyId);
        const allUsers = await repository.getUsers(familyId);

        const accessWithUserDetails = accesses.map((acc) => {
          const u = allUsers.find((user) => user.id === acc.userId);
          return {
            ...acc,
            userName: u?.name || 'Usuário',
            userEmail: u?.email || '',
            userAvatarUrl: u?.avatarUrl,
          };
        });

        res.json(accessWithUserDetails);
      } catch (error) {
        console.error('Error fetching patient access list:', error);
        res.status(500).json({ error: 'Erro ao buscar acessos do paciente' });
      }
    }
  );

  router.post(
    '/patients/:patientId/access',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const { userId, role } = req.body as { userId: string; role: PatientRole };
        const currentUserId = getCurrentUserId(req);

        // Only ADMIN on patient or Family OWNER can manage access
        const canManage = await authzService.canManageAccess(currentUserId, patientId, familyId);
        if (!canManage && req.membership?.role !== 'owner') {
          return res.status(403).json({ error: 'Apenas Administradores podem gerenciar acessos' });
        }

        if (!userId || !role) {
          return res.status(400).json({ error: 'userId e role são obrigatórios' });
        }

        const newAccess = await repository.createPatientAccess(
          {
            patientId,
            userId,
            role,
            createdBy: currentUserId,
          },
          familyId
        );

        res.status(201).json(newAccess);
      } catch (error) {
        console.error('Error adding patient access:', error);
        res.status(500).json({ error: 'Erro ao cadastrar acesso do paciente' });
      }
    }
  );

  router.delete(
    '/patients/:patientId/access/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId, id } = req.params;
        const currentUserId = getCurrentUserId(req);

        const canManage = await authzService.canManageAccess(currentUserId, patientId, familyId);
        if (!canManage && req.membership?.role !== 'owner') {
          return res.status(403).json({ error: 'Apenas Administradores podem remover acessos' });
        }

        const deleted = await repository.deletePatientAccess(id, familyId, patientId);
        if (!deleted) {
          return res.status(404).json({ error: 'Registro de acesso não encontrado' });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting patient access:', error);
        res.status(500).json({ error: 'Erro ao remover acesso do paciente' });
      }
    }
  );

  // 5. Patients List & Details (Protected by Auth & Active Membership)
  router.get(
    '/patients',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const userId = getCurrentUserId(req);
        // Owner sees all family patients; members see accessible patients
        const patients = await repository.getPatients(
          req.membership?.role === 'owner' ? undefined : userId,
          familyId
        );
        res.json(patients);
      } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Erro interno ao listar pacientes' });
      }
    }
  );

  router.get(
    '/patients/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const patient = await repository.getPatientById(req.params.id, familyId);
        if (!patient) {
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        res.json(patient);
      } catch (error) {
        console.error('Error fetching patient:', error);
        res.status(500).json({ error: 'Erro interno ao buscar paciente' });
      }
    }
  );

  router.post(
    '/patients',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const userId = getCurrentUserId(req);
        const {
          name,
          birthDate,
          bloodType,
          allergies,
          emergencyContacts,
          notes,
          primaryDoctor,
          healthInsurance,
          healthInsuranceNumber,
        } = req.body;

        if (!name || !birthDate) {
          return res.status(400).json({ error: 'Nome e data de nascimento são obrigatórios' });
        }

        const newPatient = await repository.createPatient(
          {
            name,
            birthDate,
            bloodType: bloodType || 'Não informado',
            allergies: Array.isArray(allergies) ? allergies : [],
            emergencyContacts: Array.isArray(emergencyContacts) ? emergencyContacts : [],
            notes: notes || '',
            primaryDoctor: primaryDoctor || '',
            healthInsurance: healthInsurance || '',
            healthInsuranceNumber: healthInsuranceNumber || '',
          },
          userId,
          familyId
        );
        res.status(201).json(newPatient);
      } catch (error) {
        console.error('Error creating patient:', error);
        res.status(500).json({ error: 'Erro ao cadastrar paciente' });
      }
    }
  );

  router.put(
    '/patients/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const patientId = req.params.id;
        const userId = getCurrentUserId(req);
        console.log(`[API] PUT /patients/${patientId} initiated - family: ${familyId}, user: ${userId}, role: ${req.membership?.role}`);

        const canEdit = await authzService.canEditPatient(userId, patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem alterar os dados cadastrais do paciente',
          });
        }

        const updated = await repository.updatePatient(patientId, req.body, familyId);
        if (!updated) {
          console.warn(`[API] Patient ${patientId} not found in family ${familyId}`);
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        console.log(`[API] Patient ${patientId} successfully updated in family ${familyId}`);
        res.json(updated);
      } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ error: 'Erro ao atualizar paciente' });
      }
    }
  );

  router.delete(
    '/patients/:id',
    requireAuth,
    requireActiveMembership,
    requireFamilyOwner, // Administrative operation restricted to Owner
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const deleted = await repository.deletePatient(req.params.id, familyId);
        if (!deleted) {
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({ error: 'Erro ao excluir paciente' });
      }
    }
  );

  // 6. Dashboard (Protected)
  router.get(
    '/patients/:patientId/dashboard',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const patient = await repository.getPatientById(patientId, familyId);
        if (!patient) {
          return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const [medications, appointments, exams, documents, timeline] = await Promise.all([
          repository.getMedications(patientId, familyId),
          repository.getAppointments(patientId, familyId),
          repository.getExams(patientId, familyId),
          repository.getDocuments(patientId, familyId),
          repository.getTimelineEvents(patientId, undefined, familyId),
        ]);

        const activeMedications = medications.filter((m) => m.active);
        const upcomingAppointments = appointments
          .filter((a) => a.status === 'agendada')
          .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
        const nextAppointment = upcomingAppointments[0] || null;

        const pendingExams = exams.filter(
          (e) => e.status === 'solicitado' || e.status === 'agendado'
        );

        const recentDocuments = [...documents]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 4);

        const latestEvents = [...timeline].slice(0, 5);

        res.json({
          patient,
          activeMedicationsCount: activeMedications.length,
          activeMedications,
          nextAppointment,
          pendingExamsCount: pendingExams.length,
          pendingExams,
          recentDocuments,
          latestEvents,
          totalDocumentsCount: documents.length,
          totalAppointmentsCount: appointments.length,
        });
      } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do painel' });
      }
    }
  );

  // 7. Medications (Protected)
  router.get(
    '/patients/:patientId/medications',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const medications = await repository.getMedications(req.params.patientId, familyId);
        res.json(medications);
      } catch (error) {
        console.error('Error fetching medications:', error);
        res.status(500).json({ error: 'Erro ao buscar medicamentos' });
      }
    }
  );

  router.post(
    '/patients/:patientId/medications',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para cadastrar medicamentos',
          });
        }

        const {
          name,
          dosage,
          frequency,
          times,
          startDate,
          endDate,
          prescribingDoctor,
          notes,
          active,
        } = req.body;
        if (!name || !dosage || !frequency) {
          return res.status(400).json({ error: 'Nome, dosagem e frequência são obrigatórios' });
        }
        const newMed = await repository.createMedication(
          {
            patientId,
            name,
            dosage,
            frequency,
            times: Array.isArray(times) ? times : ['08:00'],
            startDate: startDate || new Date().toISOString().split('T')[0],
            endDate,
            prescribingDoctor,
            notes,
            active: active !== undefined ? Boolean(active) : true,
          },
          familyId
        );
        res.status(201).json(newMed);
      } catch (error) {
        console.error('Error creating medication:', error);
        res.status(500).json({ error: 'Erro ao cadastrar medicamento' });
      }
    }
  );

  router.put(
    '/medications/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const med = await repository.getMedicationById(req.params.id, familyId);
        if (!med) return res.status(404).json({ error: 'Medicamento não encontrado' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, med.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para editar medicamentos',
          });
        }

        const updated = await repository.updateMedication(req.params.id, req.body, familyId, med.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating medication:', error);
        res.status(500).json({ error: 'Erro ao atualizar medicamento' });
      }
    }
  );

  router.delete(
    '/medications/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const med = await repository.getMedicationById(req.params.id, familyId);
        if (!med) return res.status(404).json({ error: 'Medicamento não encontrado' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, med.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir medicamentos',
          });
        }

        await repository.deleteMedication(req.params.id, familyId, med.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting medication:', error);
        res.status(500).json({ error: 'Erro ao excluir medicamento' });
      }
    }
  );

  // 8. Appointments (Protected)
  router.get(
    '/patients/:patientId/appointments',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const appointments = await repository.getAppointments(req.params.patientId, familyId);
        res.json(appointments);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Erro ao buscar consultas' });
      }
    }
  );

  router.post(
    '/patients/:patientId/appointments',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para agendar consultas',
          });
        }

        const {
          specialty,
          professional,
          location,
          dateTime,
          reason,
          notes,
          status,
          postConsultationNotes,
          postConsultationGuidance,
        } = req.body;
        if (!specialty || !dateTime) {
          return res.status(400).json({ error: 'Especialidade e data/hora são obrigatórios' });
        }
        const newAppt = await repository.createAppointment(
          {
            patientId,
            specialty,
            professional: professional || 'Profissional de Saúde',
            location: location || 'Consultório / Clínica',
            dateTime,
            reason: reason || 'Acompanhamento de rotina',
            notes,
            status: status || 'agendada',
            postConsultationNotes,
            postConsultationGuidance,
          },
          familyId
        );
        res.status(201).json(newAppt);
      } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Erro ao cadastrar consulta' });
      }
    }
  );

  router.put(
    '/appointments/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const appt = await repository.getAppointmentById(req.params.id, familyId);
        if (!appt) return res.status(404).json({ error: 'Consulta não encontrada' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, appt.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para alterar consultas',
          });
        }

        const updated = await repository.updateAppointment(req.params.id, req.body, familyId, appt.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Erro ao atualizar consulta' });
      }
    }
  );

  router.delete(
    '/appointments/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const appt = await repository.getAppointmentById(req.params.id, familyId);
        if (!appt) return res.status(404).json({ error: 'Consulta não encontrada' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, appt.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir consultas',
          });
        }

        await repository.deleteAppointment(req.params.id, familyId, appt.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: 'Erro ao excluir consulta' });
      }
    }
  );

  // 9. Exams (Protected)
  router.get(
    '/patients/:patientId/exams',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const exams = await repository.getExams(req.params.patientId, familyId);
        res.json(exams);
      } catch (error) {
        console.error('Error fetching exams:', error);
        res.status(500).json({ error: 'Erro ao buscar exames' });
      }
    }
  );

  router.post(
    '/patients/:patientId/exams',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para cadastrar exames',
          });
        }

        const { name, requestDate, requestingDoctor, executionDate, status, notes, documentId } =
          req.body;
        if (!name) {
          return res.status(400).json({ error: 'Nome do exame é obrigatório' });
        }
        const newExam = await repository.createExam(
          {
            patientId,
            name,
            requestDate: requestDate || new Date().toISOString().split('T')[0],
            requestingDoctor: requestingDoctor || 'Médico Assistente',
            executionDate,
            status: status || 'solicitado',
            notes,
            documentId,
          },
          familyId
        );
        res.status(201).json(newExam);
      } catch (error) {
        console.error('Error creating exam:', error);
        res.status(500).json({ error: 'Erro ao cadastrar exame' });
      }
    }
  );

  router.put(
    '/exams/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const exam = await repository.getExamById(req.params.id, familyId);
        if (!exam) return res.status(404).json({ error: 'Exame não encontrado' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, exam.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para alterar exames',
          });
        }

        const updated = await repository.updateExam(req.params.id, req.body, familyId, exam.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating exam:', error);
        res.status(500).json({ error: 'Erro ao atualizar exame' });
      }
    }
  );

  router.delete(
    '/exams/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const exam = await repository.getExamById(req.params.id, familyId);
        if (!exam) return res.status(404).json({ error: 'Exame não encontrado' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, exam.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir exames',
          });
        }

        await repository.deleteExam(req.params.id, familyId, exam.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting exam:', error);
        res.status(500).json({ error: 'Erro ao excluir exame' });
      }
    }
  );

  // 10. Documents (Protected)
  router.get(
    '/patients/:patientId/documents',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const docs = await repository.getDocuments(req.params.patientId, familyId);
        res.json(docs);
      } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Erro ao buscar documentos' });
      }
    }
  );

  router.post(
    '/patients/:patientId/documents',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para anexar documentos',
          });
        }

        const {
          title,
          category,
          fileUrl,
          fileName,
          fileType,
          fileSize,
          date,
          doctor,
          notes,
          relatedExamId,
        } = req.body;
        if (!title || !category) {
          return res.status(400).json({ error: 'Título e categoria são obrigatórios' });
        }
        const newDoc = await repository.createDocument(
          {
            patientId,
            title,
            category,
            fileUrl: fileUrl || '/mock-files/documento-anexado.pdf',
            fileName: fileName || `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
            fileType: fileType || 'application/pdf',
            fileSize: fileSize || '1.2 MB',
            date: date || new Date().toISOString().split('T')[0],
            doctor,
            notes,
            relatedExamId,
          },
          familyId
        );
        res.status(201).json(newDoc);
      } catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Erro ao salvar documento' });
      }
    }
  );

  router.put(
    '/documents/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const doc = await repository.getDocumentById(req.params.id, familyId);
        if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

        const userId = getCurrentUserId(req);
        const canEdit = await authzService.canEditRecord(userId, doc.patientId, familyId);
        if (!canEdit && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para alterar documentos',
          });
        }

        const updated = await repository.updateDocument(req.params.id, req.body, familyId, doc.patientId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ error: 'Erro ao atualizar documento' });
      }
    }
  );

  router.delete(
    '/documents/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const doc = await repository.getDocumentById(req.params.id, familyId);
        if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

        const userId = getCurrentUserId(req);
        const canDelete = await authzService.canDeleteRecord(userId, doc.patientId, familyId);
        if (!canDelete && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Apenas Administradores podem excluir documentos',
          });
        }

        await repository.deleteDocument(req.params.id, familyId, doc.patientId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Erro ao excluir documento' });
      }
    }
  );

  // 11. Timeline (Protected)
  router.get(
    '/patients/:patientId/timeline',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const { category, type, startDate, endDate } = req.query as {
          category?: string;
          type?: TimelineEventType;
          startDate?: string;
          endDate?: string;
        };
        const events = await repository.getTimelineEvents(
          patientId,
          {
            category,
            type,
            startDate,
            endDate,
          },
          familyId
        );
        res.json(events);
      } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({ error: 'Erro ao buscar linha do tempo' });
      }
    }
  );

  router.post(
    '/patients/:patientId/timeline',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const { patientId } = req.params;
        const userId = getCurrentUserId(req);

        const canCreate = await authzService.canCreateRecord(userId, patientId, familyId);
        if (!canCreate && req.membership?.role !== 'owner') {
          return res.status(403).json({
            error: 'Visualizadores não possuem permissão para registrar eventos',
          });
        }

        const { type, title, description, date, category, doctor, important } = req.body;
        if (!title || !description) {
          return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
        }
        const newEvent = await repository.createTimelineEvent(
          {
            patientId,
            type: type || 'evento_manual',
            title,
            description,
            date: date || new Date().toISOString().split('T')[0],
            category: category || 'Geral',
            doctor: doctor || '',
            important: Boolean(important),
          },
          familyId
        );
        res.status(201).json(newEvent);
      } catch (error) {
        console.error('Error creating timeline event:', error);
        res.status(500).json({ error: 'Erro ao adicionar evento na linha do tempo' });
      }
    }
  );

  router.delete(
    '/timeline/:id',
    requireAuth,
    requireActiveMembership,
    async (req: AuthorizedFamilyRequest, res: Response) => {
      try {
        const familyId = req.membership!.familyId;
        const deleted = await repository.deleteTimelineEvent(req.params.id, familyId);
        if (!deleted) {
          return res.status(404).json({ error: 'Evento não encontrado' });
        }
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting timeline event:', error);
        res.status(500).json({ error: 'Erro ao excluir evento' });
      }
    }
  );

  return router;
}

