import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { UserModel } from "../models/user.model";

export async function getUser(userId: string): Promise<UserModel | null> {
  // TODO: Add field-level validation and profile completion logic.
  const snapshot = await getFirestore().collection(COLLECTIONS.users).doc(userId).get();
  return snapshot.exists ? ({ id: snapshot.id, ...snapshot.data() } as UserModel) : null;
}
