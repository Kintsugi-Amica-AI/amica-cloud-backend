import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildLiveShareView,
  buildShareUrl,
  firstName,
  generateShareToken,
  isSmsSafeShareToken,
  isShareExpired,
  isValidShareToken,
  shareFieldsFromJourney,
} from "../services/liveShareService";

const now = new Date("2026-09-23T10:00:00.000Z");

const journey = {
  userId: "u1",
  status: "active",
  journeyType: "walk",
  destination: { name: "Home", latitude: 6.9, longitude: 79.86 },
  startLocation: { latitude: 6.8, longitude: 79.8 },
  currentLocation: { latitude: 6.85, longitude: 79.83, updatedAt: "2026-09-23T09:59:50.000Z" },
  estimatedEndTime: "2026-09-23T10:30:00.000Z",
  route: { polyline: "abc" },
};

test("tokens are long, SMS-safe and unique", () => {
  const a = generateShareToken();
  const b = generateShareToken();
  assert.ok(isValidShareToken(a));
  assert.notEqual(a, b);
  assert.equal(a.length, 22);
  assert.ok(isSmsSafeShareToken(a));
  for (let i = 0; i < 500; i++) {
    assert.match(generateShareToken(), /^[A-Za-z0-9]{22}$/);
  }
  // Links already sent with `-` or `_` still open.
  assert.ok(isValidShareToken("abc-def_ghijklmnopqrstu"));
  assert.equal(isSmsSafeShareToken("abc-def_ghijklmnopqrstu"), false);
  assert.equal(isValidShareToken("short"), false);
  assert.equal(isValidShareToken("../../users/abcdefghijklmnop"), false);
});

test("share URL points at the /j/ page", () => {
  assert.equal(buildShareUrl("tok", "https://x.web.app/"), "https://x.web.app/j/tok");
});

test("only a first name is shown", () => {
  assert.equal(firstName("  Sineth  Wickramaratna "), "Sineth");
  assert.equal(firstName(undefined), "");
});

test("an active journey mirrors her latest position", () => {
  const fields = shareFieldsFromJourney(journey, now);
  assert.equal(fields.status, "active");
  assert.equal(fields.destinationName, "Home");
  assert.deepEqual(fields.location, {
    latitude: 6.85, longitude: 79.83, updatedAt: "2026-09-23T09:59:50.000Z",
  });
  assert.equal(fields.endedAt, null);
  assert.equal(fields.expiresAt, "2026-09-23T22:30:00.000Z");
});

test("an SOS keeps the link live and marked as SOS", () => {
  assert.equal(shareFieldsFromJourney({ ...journey, status: "sos" }, now).status, "sos");
});

test("an ended journey hides her position from the page", () => {
  const fields = shareFieldsFromJourney({ ...journey, status: "safe" }, now);
  assert.equal(fields.status, "ended");
  assert.equal(fields.endReason, "safe");
  const view = buildLiveShareView(
    { token: "t", userId: "u1", journeyId: "j1", ownerName: "Sineth", ...fields },
    now,
  );
  assert.equal(view.location, null);
  assert.equal(view.destination, null);
  assert.equal(view.routePolyline, null);
  assert.equal("userId" in view, false);
  assert.equal("journeyId" in view, false);
});

test("null-island and invalid points are ignored", () => {
  const fields = shareFieldsFromJourney(
    { ...journey, currentLocation: { latitude: 0, longitude: 0 } },
    now,
  );
  assert.deepEqual(fields.location, { latitude: 6.8, longitude: 79.8, updatedAt: null });
});

test("links expire twelve hours after the deadline", () => {
  const { expiresAt } = shareFieldsFromJourney(journey, now);
  assert.equal(isShareExpired({ expiresAt }, now), false);
  assert.equal(isShareExpired({ expiresAt }, new Date("2026-09-24T00:00:00Z")), true);
});
