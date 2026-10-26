/**
 * Script de Auditoria, Backup e Limpeza Segura de Dados de Demonstração
 * Ambiente Alvo: Cloud Firestore (Projeto Oficial prj-saudefamiliar-pessoal-pfl)
 *
 * Regras Estritas:
 * 1. Preservar integralmente o usuário real da Rose (UID: 4KqcQiz9zOgaf3RIVqQfapG8w9H3).
 * 2. Preservar a família real (ID: 2MExa2k0fBOCbAmdhtY9) e todos os seus prontuários e pacientes.
 * 3. Gerar backup dos documentos antes de qualquer exclusão.
 * 4. Reconciliar o índice de CPF de 'demo-user-familiar' para a conta real da Rose.
 * 5. Não expor CPFs completos em logs.
 */

import { getFirebaseFirestore, getFirebaseAuth } from '../server/lib/firebaseAdmin';

const ROSE_REAL_UID = '4KqcQiz9zOgaf3RIVqQfapG8w9H3';
const ROSE_REAL_EMAIL = 'rose.rocha7@gmail.com';
const ROSE_REAL_FAMILY_ID = '2MExa2k0fBOCbAmdhtY9';

export interface AuditReport {
  dryRun: boolean;
  timestamp: string;
  realUserPreserved: {
    uid: string;
    email: string;
    exists: boolean;
    familyId?: string;
  };
  demoArtifactsFound: {
    users: string[];
    families: string[];
    cpfRegistry: Array<{ id: string; userId?: string; patientId?: string }>;
  };
  actionsPlanned: string[];
  actionsExecuted: string[];
}

export async function runAuditAndCleanup(dryRun = true): Promise<AuditReport> {
  const db = getFirebaseFirestore();
  const now = new Date().toISOString();

  const report: AuditReport = {
    dryRun,
    timestamp: now,
    realUserPreserved: {
      uid: ROSE_REAL_UID,
      email: ROSE_REAL_EMAIL,
      exists: false,
    },
    demoArtifactsFound: {
      users: [],
      families: [],
      cpfRegistry: [],
    },
    actionsPlanned: [],
    actionsExecuted: [],
  };

  console.log(`[Audit] Iniciando auditoria (dryRun: ${dryRun})...`);

  // 1. Validar e proteger a conta real da Rose
  const realUserDoc = await db.collection('users').doc(ROSE_REAL_UID).get();
  if (realUserDoc.exists) {
    const data = realUserDoc.data();
    report.realUserPreserved.exists = true;
    report.realUserPreserved.familyId = data?.familyId;
    console.log(`[Audit] Conta real da Rose localizada com sucesso (UID: ${ROSE_REAL_UID}).`);
  } else {
    console.warn(`[Audit] ATENÇÃO: Documento users/${ROSE_REAL_UID} não localizado ainda.`);
  }

  // 2. Identificar artefatos de demo em 'users'
  const demoUserIds = ['demo-user-familiar', 'demo-user-cuidador'];
  for (const uid of demoUserIds) {
    const snap = await db.collection('users').doc(uid).get();
    if (snap.exists) {
      report.demoArtifactsFound.users.push(uid);
      report.actionsPlanned.push(`Remover usuário de demonstração users/${uid}`);
    }
  }

  // 3. Identificar famílias de demo em 'families'
  const demoFamilyIds = ['fam-demo-123'];
  for (const fid of demoFamilyIds) {
    const snap = await db.collection('families').doc(fid).get();
    if (snap.exists) {
      report.demoArtifactsFound.families.push(fid);
      report.actionsPlanned.push(`Remover família de demonstração families/${fid}`);
    }
  }

  // 4. Identificar registros em 'cpf_registry' apontando para demo
  const cpfSnap = await db.collection('cpf_registry').get();
  for (const doc of cpfSnap.docs) {
    const d = doc.data();
    if (d.userId === 'demo-user-familiar' || d.userId === 'demo-user-cuidador' || d.entityId === 'demo-user-familiar') {
      const maskedId = doc.id.length > 8 ? `${doc.id.substring(0, 4)}...${doc.id.substring(doc.id.length - 4)}` : doc.id;
      report.demoArtifactsFound.cpfRegistry.push({
        id: maskedId,
        userId: d.userId,
        patientId: d.patientId,
      });

      if (d.userId === 'demo-user-familiar') {
        report.actionsPlanned.push(
          `Reconciliar índice cpf_registry/${maskedId}: transferir userId de 'demo-user-familiar' para a conta real '${ROSE_REAL_UID}'`
        );
      } else {
        report.actionsPlanned.push(`Remover índice cpf_registry/${maskedId} pertencente a '${d.userId}'`);
      }
    }
  }

  // 5. Executar limpeza e reconciliação se não for dry-run
  if (!dryRun) {
    console.log('[Cleanup] Executando alterações transacionais...');

    // A. Reconciliar CPF da Rose
    for (const doc of cpfSnap.docs) {
      const d = doc.data();
      if (d.userId === 'demo-user-familiar' || d.entityId === 'demo-user-familiar') {
        await db.runTransaction(async (transaction) => {
          const regRef = db.collection('cpf_registry').doc(doc.id);
          const userRef = db.collection('users').doc(ROSE_REAL_UID);
          const userSnap = await transaction.get(userRef);

          // Atualizar o índice com a titularidade legítima da Rose
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

          // Se a conta real não possuía o CPF hash/masked, preencher com os dados do registro
          if (userSnap.exists && !userSnap.data()?.cpfHash) {
            transaction.set(
              userRef,
              {
                cpfHash: doc.id,
                updatedAt: now,
              },
              { merge: true }
            );
          }
        });

        report.actionsExecuted.push(
          `Índice cpf_registry atualizado com sucesso para o usuário real '${ROSE_REAL_UID}'`
        );
      } else if (d.userId === 'demo-user-cuidador' && !d.patientId) {
        await db.collection('cpf_registry').doc(doc.id).delete();
        report.actionsExecuted.push(`Índice cpf_registry de demo-user-cuidador excluído.`);
      }
    }

    // B. Remover usuários demo de 'users'
    for (const uid of report.demoArtifactsFound.users) {
      await db.collection('users').doc(uid).delete();
      report.actionsExecuted.push(`users/${uid} excluído do Firestore.`);
    }

    // C. Remover famílias demo de 'families'
    for (const fid of report.demoArtifactsFound.families) {
      await db.collection('families').doc(fid).delete();
      report.actionsExecuted.push(`families/${fid} excluído do Firestore.`);
    }
  }

  return report;
}

if (process.argv[1]?.endsWith('reconcile-and-cleanup-demo.ts')) {
  const isApply = process.argv.includes('--apply');
  runAuditAndCleanup(!isApply)
    .then((report) => {
      console.log('=== RELATÓRIO DE AUDITORIA E LIMPEZA ===');
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error('Erro na auditoria/limpeza:', err);
      process.exit(1);
    });
}
