import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCUgG3wTKVacRWwgZsFJetWOUodTjSVrP4",
  authDomain: "chat-app-live-eac4c.firebaseapp.com",
  databaseURL: "https://chat-app-live-eac4c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-live-eac4c",
  storageBucket: "chat-app-live-eac4c.firebasestorage.app",
  messagingSenderId: "1076468049145",
  appId: "1:1076468049145:web:0887d72e663f265bdfee28",
  measurementId: "G-FSFCM8PNYX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);