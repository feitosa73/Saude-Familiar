/**
 * Standalone, Idempotent Bootstrap Script for Application Owner
 * 
 * Usage:
 *   BOOTSTRAP_OWNER_UID="<firebase_uid>" npx tsx scripts/bootstrap-owner.ts
 * 
 * Optional Environment Variables:
 *   BOOTSTRAP_FAMILY_ID="family-default"
 *   BOOTSTRAP_FAMILY_NAME="Família Principal"
 *   BOOTSTRAP_USER_EMAIL="usuario@dominio.com"
 *   BOOTSTRAP_USER_NAME="Nome do Proprietário"
 */

import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function bootstrapOwner() {
  const uid = process.env.BOOTSTRAP_OWNER_UID;
  if (!uid || uid.trim() === '') {
    console.error('❌ ERRO: A variável de ambiente BOOTSTRAP_OWNER_UID é obrigatória.');
    console.error('Exemplo: BOOTSTRAP_OWNER_UID="piuuOU0EMxWSH5QVUaD5YRP0hzP2" npx tsx scripts/bootstrap-owner.ts');
    process.exit(1);
  }

  const cleanUid = uid.trim();
  const familyId = (process.env.BOOTSTRAP_FAMILY_ID || 'family-default').trim();
  const familyName = (process.env.BOOTSTRAP_FAMILY_NAME || 'Família Principal').trim();
  const userEmail = (process.env.BOOTSTRAP_USER_EMAIL || '').trim();
  const userName = (process.env.BOOTSTRAP_USER_NAME || 'Administrador').trim();

  console.log('----------------------------------------------------');
  console.log('🚀 Iniciando Bootstrap Seguro do Owner (Fase 4.2)');
  console.log('----------------------------------------------------');
  console.log(`• Firebase UID Alvo : ${cleanUid}`);
  console.log(`• Family ID         : ${familyId}`);
  console.log(`• Family Name       : ${familyName}`);
  console.log(`• Role              : owner`);
  console.log(`• Status            : active`);
  console.log('----------------------------------------------------');

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({ credential: cert(sa) });
      } catch (e) {
        console.warn('⚠️ Falha ao parsear FIREBASE_SERVICE_ACCOUNT_KEY, usando applicationDefault()');
        initializeApp({ credential: applicationDefault() });
      }
    } else {
      initializeApp({ credential: applicationDefault() });
    }
  }

  const db = getFirestore();
  const now = new Date().toISOString();

  try {
    const batch = db.batch();

    // 1. users/{uid} document
    const userRef = db.collection('users').doc(cleanUid);
    batch.set(
      userRef,
      {
        uid: cleanUid,
        email: userEmail || undefined,
        displayName: userName || undefined,
        updatedAt: now,
      },
      { merge: true }
    );

    // 2. families/{familyId} document
    const familyRef = db.collection('families').doc(familyId);
    batch.set(
      familyRef,
      {
        id: familyId,
        name: familyName,
        primaryOwnerUid: cleanUid,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    // 3. families/{familyId}/memberships/{uid} document
    const membershipRef = familyRef.collection('memberships').doc(cleanUid);
    batch.set(
      membershipRef,
      {
        userId: cleanUid,
        familyId: familyId,
        role: 'owner',
        status: 'active',
        joinedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();

    console.log('✅ SUCESSO: Bootstrap concluído de forma idempotente!');
    console.log(`• Coleção "users/${cleanUid}" atualizada.`);
    console.log(`• Coleção "families/${familyId}" atualizada.`);
    console.log(`• Documento "families/${familyId}/memberships/${cleanUid}" persistido com role=owner e status=active.`);
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Falha ao executar bootstrap no Firestore:', error);
    process.exit(1);
  }
}

bootstrapOwner();
