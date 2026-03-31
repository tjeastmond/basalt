/** Prefix for per-collection row data tables in Postgres. */
export const COLLECTION_DATA_TABLE_PREFIX = "col_" as const;

/**
 * Max length of `table_suffix` so `col_` + suffix fits Postgres 63-byte unquoted identifier limit.
 */
export const MAX_TABLE_SUFFIX_LENGTH = 63 - COLLECTION_DATA_TABLE_PREFIX.length;

const TABLE_SUFFIX_REGEX = /^[a-z][a-z0-9_]*$/;

export function assertValidTableSuffix(suffix: string): void {
  if (!TABLE_SUFFIX_REGEX.test(suffix) || suffix.length > MAX_TABLE_SUFFIX_LENGTH) {
    throw new Error(`Invalid collection table suffix "${suffix}".`);
  }
}

/** Validated physical table name for row data (not quoted). */
export function collectionDataTableName(tableSuffix: string): string {
  assertValidTableSuffix(tableSuffix);
  return `${COLLECTION_DATA_TABLE_PREFIX}${tableSuffix}`;
}

const IDENT_REGEX = /^[a-z][a-z0-9_]*$/;

/** Column / identifier used in generated DDL (unquoted, lowercase-safe). */
export function assertSafeSqlIdentifier(name: string): void {
  if (!IDENT_REGEX.test(name) || name.length > 63) {
    throw new Error(`Invalid SQL identifier "${name}".`);
  }
}
