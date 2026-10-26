/**
 * Script de Restauração / Rollback de Sanitização do Firestore
 *
 * Utiliza o arquivo de backup gerado por scripts/reconcile-and-cleanup-demo.ts
 * para restaurar o estado dos documentos e índices caso ocorra qualquer imprevisto.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFirebaseFirestore } from '../server/lib/firebaseAdmin';
import { BackupArchive } from './reconcile-and-cleanup-demo';

export async function rollbackFromBackup(backupFilePath: string): Promise<void> {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Arquivo de backup não encontrado: ${backupFilePath}`);
  }

  const raw = fs.readFileSync(backupFilePath, 'utf-8');
  const backup: BackupArchive = JSON.parse(raw);
  const db = getFirebaseFirestore();

  console.log(`[Rollback] Iniciando restauração a partir de: ${backupFilePath}`);
  console.log(`[Rollback] Backup criado em: ${backup.metadata.createdAt}`);

  // 1. Restaurar documentos excluídos
  for (const item of backup.deletedArtifacts) {
    const docRef = db.collection(item.collection).doc(item.id);
    await docRef.set(item.data, { merge: true });
    console.log(`[Rollback] Documento restaurado: ${item.collection}/${item.id}`);

    if (item.subcollections) {
      for (const [subName, docs] of Object.entries(item.subcollections)) {
        for (const sDoc of docs) {
          await docRef.collection(subName).doc(sDoc.id).set(sDoc.data, { merge: true });
          console.log(`[Rollback] Subcoleção restaurada: ${item.collection}/${item.id}/${subName}/${sDoc.id}`);
        }
      }
    }
  }

  // 2. Reverter índices de CPF para o estado anterior
  for (const item of backup.reconciledRegistry) {
    const regRef = db.collection('cpf_registry').doc(item.hashId);
    await regRef.set(item.previousData);
    console.log(`[Rollback] Índice cpf_registry restaurado para o estado anterior: ${item.hashId}`);
  }

  // 3. Restaurar dados anteriores do usuário Rose caso tenham sido alterados
  if (backup.protectedRecords.roseOriginalUserData) {
    const userRef = db.collection('users').doc(backup.protectedRecords.roseUid);
    await userRef.set(backup.protectedRecords.roseOriginalUserData);
    console.log(`[Rollback] Registro de usuário da Rose restaurado para o estado anterior.`);
  }

  console.log('[Rollback] Restauração concluída com sucesso.');
}

if (process.argv[1]?.endsWith('rollback-demo-cleanup.ts')) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: npx tsx scripts/rollback-demo-cleanup.ts <caminho-do-arquivo-backup.json>');
    process.exit(1);
  }

  rollbackFromBackup(filePath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Rollback Erro]', err);
      process.exit(1);
    });
}
