/** Display helpers for physical row audit columns (`created_by`, `updated_by`, timestamps). */

export function formatRecordAuditTimestamp(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").slice(0, 19);
  }
  if (typeof value === "string") {
    return value.slice(0, 19).replace("T", " ");
  }
  return String(value);
}

/** Values are session user ids, or `api_key:<uuid>` for REST writes. */
export function formatRecordActorLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const s = String(value);
  if (s.startsWith("api_key:")) {
    const id = s.slice("api_key:".length);
    const short = id.length > 8 ? `${id.slice(0, 8)}…` : id;
    return `API key ${short}`;
  }
  return s;
}
