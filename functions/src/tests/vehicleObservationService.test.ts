import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addObservation,
  usualValue,
} from "../services/vehicleObservationService";

function scans(list: Array<{ vehicleType?: string; colour?: string }>) {
  let profile: unknown = undefined;
  for (const observation of list) {
    profile = addObservation(profile, observation) ?? profile;
  }
  return profile as ReturnType<typeof addObservation>;
}

test("a usual type and colour need three agreeing scans", () => {
  const two = scans([
    { vehicleType: "car", colour: "white" },
    { vehicleType: "car", colour: "white" },
  ]);
  assert.equal(two?.usualType, null);
  assert.equal(two?.usualColour, null);

  const three = scans([
    { vehicleType: "car", colour: "white" },
    { vehicleType: "car", colour: "white" },
    { vehicleType: "car", colour: "silver" },
    { vehicleType: "car", colour: "white" },
  ]);
  assert.equal(three?.observationCount, 4);
  assert.equal(three?.usualType, "car");
  assert.equal(three?.typeAgreement, 4);
  assert.equal(three?.usualColour, "white");
  assert.deepEqual(three?.colourCounts, { white: 3, silver: 1 });
});

test("one odd scan does not flip an established profile", () => {
  const profile = scans([
    ...Array(5).fill({ vehicleType: "car", colour: "white" }),
    { vehicleType: "van", colour: "red" },
  ]);
  assert.equal(profile?.usualType, "car");
  assert.equal(profile?.usualColour, "white");
});

test("a split vote has no usual value", () => {
  assert.equal(usualValue({ car: 3, van: 3 }).value, null);
  assert.equal(usualValue({ car: 3, van: 2 }).value, "car");
  assert.equal(usualValue({ car: 3, van: 2, bus: 1 }).value, null);
});

test("unknown words are ignored and empty observations are skipped", () => {
  assert.equal(addObservation(undefined, { vehicleType: "spaceship" }), null);
  const profile = addObservation(
    { observationCount: "x", typeCounts: { car: -2, tank: 9 } },
    { vehicleType: "three_wheeler", colour: "pink" },
  );
  assert.deepEqual(profile?.typeCounts, { three_wheeler: 1 });
  assert.deepEqual(profile?.colourCounts, {});
  assert.equal(profile?.observationCount, 1);
});
