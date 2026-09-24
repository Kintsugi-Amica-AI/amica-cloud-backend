import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buildAudioClipEvidence,
  hasAudioClip,
  sosAudioFromPath,
} from "../services/sosAudioService";

test("only sos_audio/{uid}/{alertId}.m4a names a clip", () => {
  assert.deepEqual(sosAudioFromPath("sos_audio/user1/alertA.m4a"), {
    uid: "user1",
    alertId: "alertA",
  });
  for (const name of [
    "sos_audio/user1/alertA.mp3",
    "sos_audio/user1/nested/alertA.m4a",
    "sos_audio/alertA.m4a",
    "sos_audio/user1/.m4a",
    "sos_audio/us er/alertA.m4a",
    "vehicle_images/CAB1234.jpg",
    undefined,
  ]) {
    assert.equal(sosAudioFromPath(name), null, String(name));
  }
});

test("clip evidence reads the phone's metadata defensively", () => {
  const clip = buildAudioClipEvidence("sos_audio/u/a.m4a", "audio/mp4", 240000, {
    durationMillis: "30012",
    recordedAtMillis: "1700000000000",
    triggerType: "voice",
  });
  assert.equal(clip.durationSeconds, 30);
  assert.equal(clip.recordedAt, "2023-11-14T22:13:20.000Z");
  assert.equal(clip.triggerType, "voice");

  const bare = buildAudioClipEvidence("sos_audio/u/a.m4a", "audio/mp4", 1, undefined);
  assert.equal(bare.durationSeconds, null);
  assert.equal(bare.recordedAt, null);
  assert.equal(bare.triggerType, null);
});

test("an alert keeps its first clip", () => {
  assert.equal(hasAudioClip(undefined), false);
  assert.equal(hasAudioClip({ evidence: {} }), false);
  assert.equal(hasAudioClip({ evidence: { voicePhraseDetected: true } }), false);
  assert.equal(hasAudioClip({ evidence: { audioClip: { path: "sos_audio/u/a.m4a" } } }), true);
});
