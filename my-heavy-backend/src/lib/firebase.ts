import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Uses GOOGLE_APPLICATION_CREDENTIALS
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

export const db = getFirestore();
