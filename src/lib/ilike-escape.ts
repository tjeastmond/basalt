/** Escape `%`, `_`, and `\` for use inside an `ILIKE` pattern with `ESCAPE '\'` */
export function escapeIlikePattern(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
