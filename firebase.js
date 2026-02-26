// firebase.js (en la raíz)
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
const firebaseConfig = {
  apiKey: "AIzaSyCwkzV8LNR5v7CVi_jW_G6OsGVfbjKiAJo",
  authDomain: "pedidosinterno-3c65d.firebaseapp.com",
  // REVISA ESTA LÍNEA CON EL LINK DE TU CONSOLA:
  databaseURL: "https://pedidosinterno-3c65d-default-rtdb.firebaseio.com", 
  projectId: "pedidosinterno-3c65d",
  storageBucket: "pedidosinterno-3c65d.firebasestorage.app",
  messagingSenderId: "464790476389",
  appId: "1:464790476389:web:fe48b652220c4b656ad88c",
  measurementId: "G-T50QD9S89Q"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);