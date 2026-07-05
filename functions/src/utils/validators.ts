export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

export function isPhoneNumber(value: string): boolean {
  return value.replace(/\D/g, "").length >= 7;
}
