import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  MultiFactorResolver,
  MultiFactorError,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  type MultiFactorInfo,
} from 'firebase/auth';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'prj-saudefamiliar-pessoal-pfl.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'prj-saudefamiliar-pessoal-pfl',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'prj-saudefamiliar-pessoal-pfl.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
);

let app: any = null;
let auth: any = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    
    // Explicit cross-browser persistence avoiding Safari & Brave IndexedDB closing/hidden issues
    // browserPopupRedirectResolver is required for signInWithPopup / signInWithRedirect when using initializeAuth
    try {
      auth = initializeAuth(app, {
        persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      auth = getAuth(app);
    }

    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: 'select_account',
    });
  } catch (error) {
    console.error('Erro ao inicializar Firebase Auth no cliente:', error);
  }
}

export {
  app,
  auth,
  googleProvider,
  EmailAuthProvider,
  browserPopupRedirectResolver,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  multiFactor,
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type FirebaseUser,
  type MultiFactorInfo,
  type TotpSecret,
  type MultiFactorResolver,
  type MultiFactorError,
};
