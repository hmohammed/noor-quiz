import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * The admin Auth client, on the same default admin app as `getAdminFirestore()`. No I/O:
 * the SDK fetches keys on first verify. Project and emulator host come from the runtime
 * (`GCLOUD_PROJECT`, `FIREBASE_AUTH_EMULATOR_HOST`).
 */
export function getAdminAuth(): Auth {
  return getAuth(getApps()[0] ?? initializeApp());
}
