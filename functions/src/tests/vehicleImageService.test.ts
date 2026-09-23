import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hasVehicleImage,
  plateFromImagePath,
} from "../services/vehicleImageService";

test("only vehicle_images/{plate}.jpg objects name a plate", () => {
  assert.equal(plateFromImagePath("vehicle_images/CAB1234.jpg"), "CAB1234");
  assert.equal(plateFromImagePath("vehicle_images/KA1234.jpg"), "KA1234");
  assert.equal(plateFromImagePath("vehicle_images/651234.jpg"), "651234");
  for (const name of [
    "vehicle_images/cab1234.jpg",
    "vehicle_images/CAB1234.png",
    "vehicle_images/CAB-1234.jpg",
    "vehicle_images/nested/CAB1234.jpg",
    "other/CAB1234.jpg",
    "vehicle_images/.jpg",
    undefined,
  ]) {
    assert.equal(plateFromImagePath(name), null, String(name));
  }
});

test("a vehicle keeps its first photo", () => {
  assert.equal(hasVehicleImage(undefined), false);
  assert.equal(hasVehicleImage({ status: "unknown" }), false);
  assert.equal(hasVehicleImage({ image: null }), false);
  assert.equal(hasVehicleImage({ image: { path: "vehicle_images/CAB1234.jpg" } }), true);
});
