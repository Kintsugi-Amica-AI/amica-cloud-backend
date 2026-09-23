import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  INVITE_ALPHABET,
  generateInviteCode,
  inviteProblem,
  isGuardianResponse,
  normalizeInviteCode,
} from "../services/guardianService";
import {
  buildGuardianResponsePush,
  buildJourneyStartedPush,
  buildSosPush,
} from "../services/pushService";

const now = new Date("2026-09-23T10:00:00.000Z");
const invite = {
  userId: "owner",
  contactId: "c1",
  expiresAt: "2026-09-30T10:00:00.000Z",
  usedAt: null,
};

test("codes use only unambiguous characters", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateInviteCode();
    assert.equal(code.length, 6);
    for (const char of code) assert.ok(INVITE_ALPHABET.includes(char));
  }
});

test("typed codes are normalised", () => {
  assert.equal(normalizeInviteCode(" ab3-kx9 "), "AB3KX9");
  assert.equal(normalizeInviteCode("AB0KX9"), null);
  assert.equal(normalizeInviteCode("ABC"), null);
  assert.equal(normalizeInviteCode(42), null);
});

test("invites are single use, expire, and cannot link to yourself", () => {
  assert.equal(inviteProblem(invite, "guardian", now), null);
  assert.equal(inviteProblem(undefined, "guardian", now), "not_found");
  assert.equal(inviteProblem({ ...invite, usedAt: "x" }, "guardian", now), "used");
  assert.equal(
    inviteProblem({ ...invite, expiresAt: "2026-09-01T00:00:00Z" }, "guardian", now),
    "expired",
  );
  assert.equal(inviteProblem(invite, "owner", now), "own_invite");
});

test("only the two one-tap replies are accepted", () => {
  assert.ok(isGuardianResponse("calling"));
  assert.ok(isGuardianResponse("alerted_others"));
  assert.equal(isGuardianResponse("anything"), false);
});

test("SOS push carries location, live link and only string values", () => {
  const push = buildSosPush({
    alertId: "a1", ownerUid: "u1", ownerName: "Sineth", ownerPhone: "+94770000000",
    triggerType: "manual", latitude: 6.9271, longitude: 79.8612,
    liveUrl: "https://x.web.app/j/tok",
  });
  assert.equal(push.type, "sos");
  assert.equal(push.title, "Sineth needs help");
  assert.equal(push.data.mapsUrl, "https://maps.google.com/?q=6.927100,79.861200");
  assert.equal(push.data.liveUrl, "https://x.web.app/j/tok");
  for (const value of Object.values(push.data)) assert.equal(typeof value, "string");
});

test("SOS push without a location omits map fields", () => {
  const push = buildSosPush({
    alertId: "a1", ownerUid: "u1", ownerName: "", ownerPhone: "", triggerType: "voice",
  });
  assert.equal(push.data.mapsUrl, undefined);
  assert.equal(push.title, "Someone in your circle needs help");
});

test("journey and response pushes read naturally", () => {
  assert.equal(
    buildJourneyStartedPush({
      journeyId: "j", ownerUid: "u", ownerName: "Sineth", ownerPhone: "",
      destinationName: "Home", liveUrl: "u",
    }).body,
    "Heading to Home. Tap to watch live.",
  );
  assert.equal(
    buildGuardianResponsePush({ alertId: "a", guardianName: "Amma", response: "calling" }).title,
    "Amma is calling you now",
  );
});
