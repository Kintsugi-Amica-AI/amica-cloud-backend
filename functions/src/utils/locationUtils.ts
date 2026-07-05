export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function isValidCoordinates(location: Coordinates): boolean {
  return (
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}
