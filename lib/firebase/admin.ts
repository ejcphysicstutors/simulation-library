import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getPrivateKey(): string | undefined {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = getPrivateKey();

export const isFirebaseAdminConfigured = Boolean(projectId && clientEmail && privateKey);

const adminApp = isFirebaseAdminConfigured
  ? getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  : null;

export const adminAuth = adminApp ? getAuth(adminApp) : null;
export const adminDb = adminApp ? getFirestore(adminApp) : null;
