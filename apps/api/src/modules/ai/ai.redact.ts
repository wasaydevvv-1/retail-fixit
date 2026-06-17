/** Truncate text for logs and audit (avoid storing full customer PII). */
export function previewText(text: string, maxLength = 400): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}
