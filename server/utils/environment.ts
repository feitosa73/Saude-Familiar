/**
 * Environment detection utility for Saúde Familiar.
 *
 * Ensures total separation between:
 * - Production: Official GCP Cloud Run deployment managed via GitHub repository,
 *   using production Firestore (prj-saudefamiliar-pessoal-pfl) and strict Firebase Auth.
 * - AI Studio / Development: Independent preview container, using local isolated
 *   database (data/local-db.json via MemoryRepositories) and zero connection to production.
 */

export function isAiStudioOrDev(): boolean {
  // Test environments are always isolated
  if (process.env.NODE_ENV === 'test' || Boolean(process.env.TSX_TEST)) {
    return true;
  }

  // Explicit mock/memory storage driver
  if (
    process.env.STORAGE_DRIVER === 'mock' ||
    process.env.STORAGE_DRIVER === 'memory' ||
    process.env.STORAGE_DRIVER === 'local'
  ) {
    return true;
  }

  // AI Studio Cloud Run preview containers have service names starting with ais- (e.g. ais-dev-..., ais-pre-...)
  if (process.env.K_SERVICE && process.env.K_SERVICE.startsWith('ais-')) {
    return true;
  }

  // Explicit AI Studio environment flags
  if (process.env.AI_STUDIO === 'true' || process.env.VITE_AI_STUDIO === 'true') {
    return true;
  }

  // Default to dev if NODE_ENV is development
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

export function isProductionEnvironment(): boolean {
  if (isAiStudioOrDev()) {
    return false;
  }

  const isCloudRun = Boolean(process.env.K_SERVICE);
  const isNodeProd = process.env.NODE_ENV === 'production';

  return isNodeProd || isCloudRun;
}
