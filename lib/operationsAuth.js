import { inventoryAuth, inventoryDb } from "@/firebase";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { buildTrustedCompanyContext, resolveOperationsLogin } from "@/lib/companyProfiles";

async function resolveAuthorization(user) {
  const token = await user.getIdTokenResult();
  const snapshot = await getDoc(doc(inventoryDb, "users", user.uid));
  if (!snapshot.exists()) {
    throw new Error("Tu usuario no tiene un perfil de empresa configurado.");
  }
  const profile = snapshot.data() || {};
  if (profile.active === false) throw new Error("Tu usuario esta desactivado.");
  if (token.claims?.branchId && token.claims.branchId !== profile.branchId) {
    throw new Error("Tus permisos cambiaron. Vuelve a iniciar sesion.");
  }
  return profile;
}

async function resolveSession(user) {
  const authorization = await resolveAuthorization(user);
  return {
    firebaseUser: user,
    company: buildTrustedCompanyContext(user, authorization),
  };
}

export function observeOperationsSession(callback) {
  return onAuthStateChanged(inventoryAuth, async (user) => {
    if (!user) {
      callback({ loading: false, session: null, error: null });
      return;
    }
    try {
      callback({ loading: false, session: await resolveSession(user), error: null });
    } catch (error) {
      await signOut(inventoryAuth).catch(() => undefined);
      callback({ loading: false, session: null, error });
    }
  });
}

export async function loginOperations(login, password) {
  await setPersistence(inventoryAuth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(
    inventoryAuth,
    resolveOperationsLogin(login),
    password,
  );
  try {
    return await resolveSession(credential.user);
  } catch (error) {
    await signOut(inventoryAuth).catch(() => undefined);
    throw error;
  }
}

export function logoutOperations() {
  return signOut(inventoryAuth);
}

export function getOperationsFirebaseUser() {
  return inventoryAuth.currentUser || null;
}
