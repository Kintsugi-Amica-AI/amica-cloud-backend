import {
  buildUserSafetySettings,
  getDefaultSafetySettings,
  normalizeSecretPhrase,
} from "../services/userService";

export function userServiceSmokeTest(): boolean {
  // TODO: Replace with Firebase emulator backed tests when profile triggers are added.
  const defaults = getDefaultSafetySettings();
  const customSettings = buildUserSafetySettings({
    fakeCallContactName: "Mother",
    fakeCallPhoneNumber: "+94771234567",
    voiceSosEnabled: false,
  });

  return (
    normalizeSecretPhrase("  Amica   HELP   Me  ") === "amica help me" &&
    defaults.defaultEmergencyMessage === "I need help. This is my live location." &&
    defaults.voiceSosEnabled === true &&
    defaults.secretPhraseEnabled === true &&
    customSettings.fakeCallContactName === "Mother" &&
    customSettings.fakeCallPhoneNumber === "+94771234567" &&
    customSettings.voiceSosEnabled === false &&
    customSettings.secretPhraseEnabled === true
  );
}
