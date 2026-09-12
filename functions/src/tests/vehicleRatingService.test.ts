import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addRating } from "../services/vehicleRatingService";

test("rating updates weighted totals, not an average of averages", () => {
  assert.deepEqual(addRating(18, 4, 2), {
    ratingTotal: 20, ratingCount: 5, ratingAverage: 4,
  });
});
test("invalid ratings are rejected", () => {
  for (const stars of [0, 6, 2.5, NaN]) {
    assert.throws(() => addRating(0, 0, stars));
  }
});
