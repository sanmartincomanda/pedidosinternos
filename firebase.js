import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwkzV8LNR5v7CVi_jW_G6OsGVfbjKiAJo",
  authDomain: "pedidosinterno-3c65d.firebaseapp.com",
  databaseURL: "https://pedidosinterno-3c65d-default-rtdb.firebaseio.com",
  projectId: "pedidosinterno-3c65d",
  storageBucket: "pedidosinterno-3c65d.firebasestorage.app",
  messagingSenderId: "464790476389",
  appId: "1:464790476389:web:fe48b652220c4b656ad88c",
  measurementId: "G-T50QD9S89Q",
};

const accountingFirebaseConfig = {
  apiKey: "AIzaSyAxNua6dWb-0u_d5FUYLEwgrdGYxKJbtJs",
  authDomain: "sistema-contable-csm-granada.firebaseapp.com",
  projectId: "sistema-contable-csm-granada",
  storageBucket: "sistema-contable-csm-granada.firebasestorage.app",
  messagingSenderId: "328470883059",
  appId: "1:328470883059:web:a08c7367893eab1bc5a586",
  measurementId: "G-RSLY1FP9W2",
};

const inventoryFirebaseConfig = {
  apiKey: "AIzaSyCNjoUvZdproZfv1HqAVeyHA94Nn7NYwBA",
  authDomain: "inventario-sanmartin.firebaseapp.com",
  projectId: "inventario-sanmartin",
  storageBucket: "inventario-sanmartin.firebasestorage.app",
  messagingSenderId: "135175270983",
  appId: "1:135175270983:web:66add2c6cd34ba07333762",
  measurementId: "G-DSTY4KY0T8",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const accountingApp =
  getApps().find((item) => item.name === "accounting") ||
  initializeApp(accountingFirebaseConfig, "accounting");
const inventoryApp =
  getApps().find((item) => item.name === "inventory") ||
  initializeApp(inventoryFirebaseConfig, "inventory");

export const db = getDatabase(app);
export const accountingDb = getFirestore(accountingApp);
export const inventoryDb = getFirestore(inventoryApp);
export const inventoryAuth = getAuth(inventoryApp);
