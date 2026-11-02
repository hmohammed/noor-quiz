import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * The admin Firestore client. The only place that initialises the admin app; reuses it
 * on later calls. No I/O: the SDK connects on first use. Project and emulator host come
 * from the runtime (`GCLOUD_PROJECT`, `FIRESTORE_EMULATOR_HOST`).
 */
export function getAdminFirestore(): Firestore {
  return getFirestore(getApps()[0] ?? initializeApp());
}
