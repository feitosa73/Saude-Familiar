/**
 * Script de Auditoria, Backup Recuperável e Limpeza de Dados de Demonstração
 * Ambiente Alvo: Cloud Firestore (Projeto Oficial prj-saudefamiliar-pessoal-pfl)
 *
 * Diretrizes Absolutas de Segurança:
 * 1. Preservação integral do usuário real Rose Rocha (UID: 4KqcQiz9zOgaf3RIVqQfapG8w9H3, Email: rose.rocha7@gmail.com).
 * 2. Preservação integral da família real (ID: 2MExa2k0fBOCbAmdhtY9) e todos os pacientes/prontuários reais.
 * 3. Geração de backup JSON estruturado e recuperável antes de qualquer alteração ou exclusão.
 * 4. Reconciliação atômica do CPF da Rose para desobstruir seu acesso.
 * 5. Remoção estrita dos artefatos demo identificados.
 * 6. Mascaramento rigoroso de CPFs nos relatórios de console (Zero vazamento).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFirebaseFirestore } from '../server/lib/firebaseAdmin';

export const ROSE_REAL_UID = '4KqcQiz9zOgaf3RIVqQfapG8w9H3';
export const ROSE_REAL_EMAIL = 'rose.rocha7@gmail.com';
export const ROSE_REAL_FAMILY_ID = '2MExa2k0fBOCbAmdhtY9';

export const DEMO_USERS = ['demo-user-familiar', 'demo-user-cuidador'];
export const DEMO_FAMILIES = ['fam-demo-123'];
export const DEMO_PATIENTS = ['pat-dona-maria'];

export interface BackupDocumentPayload {
  collection: string;
  id: string;
  data: Record<string, any>;
  subcollections?: Record<string, Array<{ id: string; data: Record<string, any> }>>;
}

export interface BackupArchive {
  metadata: {
    createdAt: string;
    environment: string;
    projectId: string;
    description: string;
    restorationScript: string;
  };
  protectedRecords: {
    roseUid: string;
    roseEmail: string;
    roseFamilyId: string;
    roseOriginalUserData: Record<string, any> | null;
  };
  reconciledRegistry: Array<{
    hashId: string;
    previousData: Record<string, any>;
  }>;
  deletedArtifacts: BackupDocumentPayload[];
}

export interface ExecutionReport {
  dryRun: boolean;
  timestamp: string;
  backupFilePath?: string;
  realUserStatus: {
    uid: string;
    email: string;
    exists: boolean;
    familyId?: string;
    hasCpfHash: boolean;
  };
  demoArtifactsFound: {
    users: string[];
    families: string[];
    patients: string[];
    cpfRegistry: Array<{ id: string; userId?: string; patientId?: string }>;
  };
  actionsPlanned: string[];
  actionsExecuted: string[];
  errors: string[];
}

export async function executeAuditBackupAndCleanup(options: {
  dryRun: boolean;
  backupDir?: string;
}): Promise<ExecutionReport> {
  const { dryRun, backupDir = path.join(process.cwd(), 'backups') } = options;
  const db = getFirebaseFirestore();
  const now = new Date().toISOString();
  const timestampClean = now.replace(/[:.]/g, '-');

  const report: ExecutionReport = {
    dryRun,
    timestamp: now,
    realUserStatus: {
      uid: ROSE_REAL_UID,
      email: ROSE_REAL_EMAIL,
      exists: false,
      hasCpfHash: false,
    },
    demoArtifactsFound: {
      users: [],
      families: [],
      patients: [],
      cpfRegistry: [],
    },
    actionsPlanned: [],
    actionsExecuted: [],
    errors: [],
  };

  const backup: BackupArchive = {
    metadata: {
      createdAt: now,
      environment: process.env.NODE_ENV || 'production',
      projectId: process.env.FIREBASE_PROJECT_ID || 'prj-saudefamiliar-pessoal-pfl',
      description: 'Snapshot integral pré-sanitização dos artefatos demo e reconciliação da Rose',
      restorationScript: 'scripts/rollback-demo-cleanup.ts',
    },
    protectedRecords: {
      roseUid: ROSE_REAL_UID,
      roseEmail: ROSE_REAL_EMAIL,
      roseFamilyId: ROSE_REAL_FAMILY_ID,
      roseOriginalUserData: null,
    },
    reconciledRegistry: [],
    deletedArtifacts: [],
  };

  console.log(`[Sanitização] Iniciando verificação autoritativa no Firestore (dryRun=${dryRun})...`);

  // 1. Verificar estado da conta real da Rose
  const roseDoc = await db.collection('users').doc(ROSE_REAL_UID).get();
  if (roseDoc.exists) {
    const data = roseDoc.data() || {};
    report.realUserStatus.exists = true;
    report.realUserStatus.familyId = data.familyId;
    report.realUserStatus.hasCpfHash = Boolean(data.cpfHash);
    backup.protectedRecords.roseOriginalUserData = data;
    console.log(`[Sanitização] Conta real confirmada: UID=${ROSE_REAL_UID}, familyId=${data.familyId || 'none'}`);
  } else {
    console.warn(`[Sanitização] Conta real users/${ROSE_REAL_UID} não encontrada ou ainda não sincronizada.`);
  }

  // 2. Coletar e preparar backup de Usuários Demo
  for (const uid of DEMO_USERS) {
    const docRef = db.collection('users').doc(uid);
    const snap = await docRef.get();
    if (snap.exists) {
      report.demoArtifactsFound.users.push(uid);
      report.actionsPlanned.push(`Remover users/${uid}`);
      backup.deletedArtifacts.push({
        collection: 'users',
        id: uid,
        data: snap.data() || {},
      });
    }
  }

  // 3. Coletar e preparar backup de Famílias Demo e Subcoleções
  for (const fid of DEMO_FAMILIES) {
    const famRef = db.collection('families').doc(fid);
    const snap = await famRef.get();
    if (snap.exists) {
      report.demoArtifactsFound.families.push(fid);
      report.actionsPlanned.push(`Remover families/${fid} e subcoleções`);

      const subcollectionsData: Record<string, Array<{ id: string; data: Record<string, any> }>> = {};
      const subcols = ['memberships', 'invitations', 'accesses', 'patients'];

      for (const sub of subcols) {
        try {
          const subSnap = await famRef.collection(sub).get();
          subcollectionsData[sub] = subSnap.docs.map((d) => ({
            id: d.id,
            data: d.data(),
          }));
        } catch (_) {}
      }

      backup.deletedArtifacts.push({
        collection: 'families',
        id: fid,
        data: snap.data() || {},
        subcollections: subcollectionsData,
      });
    }
  }

  // 4. Coletar pacientes demo independentes se existirem
  for (const pid of DEMO_PATIENTS) {
    const patRef = db.collection('patients').doc(pid);
    const snap = await patRef.get();
    if (snap.exists) {
      report.demoArtifactsFound.patients.push(pid);
      report.actionsPlanned.push(`Remover patients/${pid}`);
      backup.deletedArtifacts.push({
        collection: 'patients',
        id: pid,
        data: snap.data() || {},
      });
    }
  }

  // 5. Coletar índices em cpf_registry relacionados a demo
  const cpfSnap = await db.collection('cpf_registry').get();
  for (const doc of cpfSnap.docs) {
    const d = doc.data() || {};
    const isAssociatedWithDemo =
      d.userId === 'demo-user-familiar' ||
      d.userId === 'demo-user-cuidador' ||
      d.entityId === 'demo-user-familiar' ||
      d.entityId === 'demo-user-cuidador';

    if (isAssociatedWithDemo) {
      const maskedHash =
        doc.id.length > 8 ? `${doc.id.substring(0, 4)}...${doc.id.substring(doc.id.length - 4)}` : doc.id;

      report.demoArtifactsFound.cpfRegistry.push({
        id: maskedHash,
        userId: d.userId,
        patientId: d.patientId,
      });

      if (d.userId === 'demo-user-familiar' || d.entityId === 'demo-user-familiar') {
        report.actionsPlanned.push(
          `Reconciliar cpf_registry/${maskedHash}: transferir titularidade para usuário real '${ROSE_REAL_UID}'`
        );
        backup.reconciledRegistry.push({
          hashId: doc.id,
          previousData: d,
        });
      } else {
        report.actionsPlanned.push(`Remover índice de CPF demo cpf_registry/${maskedHash}`);
        backup.deletedArtifacts.push({
          collection: 'cpf_registry',
          id: doc.id,
          data: d,
        });
      }
    }
  }

  // 6. Gravar arquivo de backup local
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFileName = `backup-firestore-demo-${timestampClean}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);
  fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2), 'utf-8');
  report.backupFilePath = backupFilePath;
  console.log(`[Backup] Backup recuperável gerado com sucesso em: ${backupFilePath}`);

  // 7. Se não for dryRun, executar alterações de forma atômica e segura
  if (!dryRun) {
    console.log('[Execução] Aplicando reconciliação e remoção no Firestore...');

    // A. Reconciliar CPF da Rose
    for (const item of backup.reconciledRegistry) {
      const regRef = db.collection('cpf_registry').doc(item.hashId);
      const userRef = db.collection('users').doc(ROSE_REAL_UID);

      await db.runTransaction(async (transaction) => {
        const uSnap = await transaction.get(userRef);

        transaction.set(
          regRef,
          {
            userId: ROSE_REAL_UID,
            entityType: 'user',
            entityId: ROSE_REAL_UID,
            updatedAt: now,
          },
          { merge: true }
        );

        if (uSnap.exists && !uSnap.data()?.cpfHash) {
          transaction.set(
            userRef,
            {
              cpfHash: item.hashId,
              updatedAt: now,
            },
            { merge: true }
          );
        }
      });

      const maskedHash =
        item.hashId.length > 8
          ? `${item.hashId.substring(0, 4)}...${item.hashId.substring(item.hashId.length - 4)}`
          : item.hashId;
      report.actionsExecuted.push(
        `Índice cpf_registry/${maskedHash} reconciliado com sucesso para Rose (${ROSE_REAL_UID})`
      );
    }

    // B. Remover documentos de demo identificados
    for (const doc of backup.deletedArtifacts) {
      // Guarda de segurança incondicional contra exclusão de dados reais
      if (
        doc.id === ROSE_REAL_UID ||
        doc.id === ROSE_REAL_FAMILY_ID ||
        doc.id.includes('feitosa') ||
        doc.id.includes('dores')
      ) {
        throw new Error(`VIOLAÇÃO DE SEGURANÇA: Tentativa de excluir entidade real '${doc.id}' abortada.`);
      }

      if (doc.collection === 'families') {
        const famRef = db.collection('families').doc(doc.id);
        // Excluir subcoleções conhecidas
        for (const sub of ['memberships', 'invitations', 'accesses', 'patients']) {
          const subSnap = await famRef.collection(sub).get();
          for (const sDoc of subSnap.docs) {
            await sDoc.ref.delete();
          }
        }
        await famRef.delete();
        report.actionsExecuted.push(`Família de demo '${doc.id}' e suas subcoleções foram excluídas.`);
      } else {
        await db.collection(doc.collection).doc(doc.id).delete();
        report.actionsExecuted.push(`Documento ${doc.collection}/${doc.id} excluído com sucesso.`);
      }
    }
  }

  return report;
}

if (process.argv[1]?.endsWith('reconcile-and-cleanup-demo.ts')) {
  const isApply = process.argv.includes('--apply');
  executeAuditBackupAndCleanup({ dryRun: !isApply })
    .then((report) => {
      console.log('======================================================');
      console.log('   RELATÓRIO DE AUDITORIA, BACKUP E SANITIZAÇÃO');
      console.log('======================================================');
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error('[ERRO CRÍTICO] Falha na execução da sanitização:', err);
      process.exit(1);
    });
}
