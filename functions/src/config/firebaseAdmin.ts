import admin from "firebase-admin";

export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  return admin.initializeApp();
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}
