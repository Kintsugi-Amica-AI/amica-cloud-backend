export function addRating(total: number, count: number, stars: number) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error("Rating must be an integer from 1 to 5.");
  }
  const ratingTotal = (Number.isFinite(total) && total >= 0 ? total : 0) + stars;
  const ratingCount = (Number.isInteger(count) && count >= 0 ? count : 0) + 1;
  return { ratingTotal, ratingCount, ratingAverage: ratingTotal / ratingCount };
}
