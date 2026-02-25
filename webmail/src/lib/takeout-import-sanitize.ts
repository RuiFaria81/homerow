export function stripNullBytes(value: string): string {
  return value.includes("\u0000") ? value.replace(/\u0000/g, "") : value;
}

export function sanitizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return stripNullBytes(value);
}

export function sanitizeTextArray(values: string[]): string[] {
  return values.map((value) => stripNullBytes(value));
}
