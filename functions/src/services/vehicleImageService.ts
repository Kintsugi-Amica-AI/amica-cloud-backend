/**
 * First photo of each vehicle.
 *
 * The phone uploads `vehicle_images/{plate}.jpg` (cropped to the vehicle, no
 * EXIF) the first time a plate with no photo is scanned. Storage rules allow
 * that object to be created once and never replaced. The
 * `onVehicleImageUploaded` trigger then records it on `vehicles/{plate}.image`
 * so the app knows not to upload again and can show it to later riders.
 */

export const VEHICLE_IMAGE_PREFIX = "vehicle_images/";

/** Letter series (CAB1234) or numeric (651234), as the app canonicalises. */
const PLATE_PATTERN = /^(?:[A-Z]{2,3}[0-9]{4}|[0-9]{5,7})$/;

/** The plate a Storage object is the photo of, or null for anything else. */
export function plateFromImagePath(name: unknown): string | null {
  if (typeof name !== "string" || !name.startsWith(VEHICLE_IMAGE_PREFIX)) {
    return null;
  }
  const file = name.slice(VEHICLE_IMAGE_PREFIX.length);
  if (!file.endsWith(".jpg")) return null;
  const plate = file.slice(0, -".jpg".length);
  return PLATE_PATTERN.test(plate) ? plate : null;
}

/** True when the vehicle document already has a saved photo. */
export function hasVehicleImage(vehicle: Record<string, unknown> | undefined): boolean {
  const image = vehicle?.image;
  return typeof image === "object" && image !== null &&
    typeof (image as { path?: unknown }).path === "string";
}
