import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
    // Check for service account credentials
    // Priority: FIREBASE_SERVICE_ACCOUNT_BASE64 > GOOGLE_APPLICATION_CREDENTIALS > applicationDefault

    let credential: admin.credential.Credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        // HuggingFace Spaces: Use base64-encoded service account JSON
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
        );
        credential = admin.credential.cert(serviceAccount);
        console.log('[Firebase] Initialized with base64 service account');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Local/GCP: Use file path
        credential = admin.credential.applicationDefault();
        console.log('[Firebase] Initialized with applicationDefault');
    } else {
        console.error('[Firebase] ERROR: No credentials found!');
        console.error('Set FIREBASE_SERVICE_ACCOUNT_BASE64 (recommended) or GOOGLE_APPLICATION_CREDENTIALS');
        throw new Error('Firebase credentials not configured');
    }

    admin.initializeApp({
        credential,
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

export const db = getFirestore();
