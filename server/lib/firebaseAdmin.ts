import 'dotenv/config';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK Initialization
 *
 * Utiliza Application Default Credentials (ADC) automaticamente fornecidas
 * pelo ambiente GCP / Cloud Run através da Runtime Service Account
 * (sa-saudefamiliar-runtime@prj-saudefamiliar-pessoal-pfl.iam.gserviceaccount.com).
 * Não requer nem deve utilizar arquivos de chave JSON locais.
 */
let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseAdminApp(): App {
  if (cachedApp) return cachedApp;

  const apps = getApps();
  if (apps.length > 0 && apps[0]) {
    cachedApp = apps[0];
    return cachedApp;
  }

  // Prioritize official project ID prj-saudefamiliar-pessoal-pfl
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'prj-saudefamiliar-pessoal-pfl';

  cachedApp = initializeApp({
    projectId,
  });
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseAdminApp();
  cachedAuth = getAuth(app);
  return cachedAuth;
}

export function getFirebaseFirestore(): Firestore {
  if (cachedDb) return cachedDb;

  const app = getFirebaseAdminApp();
  // Firestore autoritativo: (default) no projeto oficial prj-saudefamiliar-pessoal-pfl
  const db = getFirestore(app);

  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Settings already applied
  }

  cachedDb = db;
  return cachedDb;
}



