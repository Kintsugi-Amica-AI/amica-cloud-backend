import {
  buildEmergencyContactPayload,
  canUserAccessEmergencyContact,
  normalizeEmergencyContactInput,
  validateEmergencyContactInput,
} from "../services/emergencyContactService";

export function emergencyContactServiceSmokeTest(): boolean {
  // TODO: Replace with Firestore emulator tests when the team adds emulator CI.
  const validInput = {
    userId: "sample-user-1",
    name: "Mother",
    phone: "+94771234567",
  };
  const validResult = validateEmergencyContactInput(validInput);
  const missingNameResult = validateEmergencyContactInput({
    userId: "sample-user-1",
    phone: "+94771234567",
  });
  const missingPhoneResult = validateEmergencyContactInput({
    userId: "sample-user-1",
    name: "Mother",
  });
  const normalized = normalizeEmergencyContactInput(validInput);
  const payload = buildEmergencyContactPayload(validInput, "sample-user-1");

  return (
    validResult.isValid &&
    !missingNameResult.isValid &&
    missingNameResult.errors.includes("name is required") &&
    !missingPhoneResult.isValid &&
    missingPhoneResult.errors.includes("phone is required") &&
    normalized.priority === 1 &&
    normalized.isActive === true &&
    normalized.notificationMethods?.[0] === "sms" &&
    payload.schemaVersion === 1 &&
    canUserAccessEmergencyContact("sample-user-1", "sample-user-1") &&
    !canUserAccessEmergencyContact("sample-user-1", "other-user")
  );
}
