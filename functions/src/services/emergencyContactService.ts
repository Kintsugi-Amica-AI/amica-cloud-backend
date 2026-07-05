import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { EmergencyContactModel } from "../models/emergencyContact.model";

export async function listEmergencyContacts(userId: string): Promise<EmergencyContactModel[]> {
  // TODO: Add paging and contact verification status.
  const snapshot = await getFirestore()
    .collection(COLLECTIONS.emergencyContacts)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EmergencyContactModel[];
}
