import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK Initialization
 *
 * Utiliza Application Default Credentials (ADC) automaticamente fornecidas
 * pelo ambiente GCP / Cloud Run através da Runtime Service Account.
 * Não requer nem deve utilizar arquivos de chave JSON locais.
 */

export function getFirebaseAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0 && apps[0]) {
    return apps[0];
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCP_PROJECT;

  return initializeApp({
    ...(projectId ? { projectId } : {}),
  });
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}
