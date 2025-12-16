import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAwOPCxJTqkvELtMZxNZYUKSPRJ5tz6hMw",
    authDomain: "weakly-research-webapp.firebaseapp.com",
    projectId: "weakly-research-webapp",
    storageBucket: "weakly-research-webapp.firebasestorage.app",
    messagingSenderId: "649902848252",
    appId: "1:649902848252:web:29938ce0dc7b46b04a7f79",
    measurementId: "G-P9DEK16V0R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
