import { sql, type SQL } from "drizzle-orm";

import type { CollectionFieldDefinition, CollectionFieldType } from "@/lib/collection-fields";
import {
  assertSafeSqlIdentifier,
  assertValidTableSuffix,
  collectionDataTableName,
} from "@/lib/collection-physical-table";

export type SqlExecutor = { execute: (query: SQL) => Promise<unknown> };

/** Drizzle `execute()` on raw SQL returns node-pg `{ rows }`, not a row array. */
function rowsFromPgExecute<T extends Record<string, unknown>>(result: unknown): T[] {
  if (result !== null && typeof result === "object" && "rows" in result) {
    const { rows } = result as { rows: unknown };
    if (Array.isArray(rows)) {
      return rows as T[];
    }
  }
  if (Array.isArray(result)) {
    return result as T[];
  }
  return [];
}

function formatSqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function uniqueConstraintName(tableSuffix: string, columnName: string): string {
  assertValidTableSuffix(tableSuffix);
  assertSafeSqlIdentifier(columnName);
  let s = `uq_${tableSuffix}_${columnName}`;
  if (s.length > 63) {
    s = s.slice(0, 63).replace(/_+$/g, "");
  }
  assertSafeSqlIdentifier(s);
  return s;
}

function pgTypeForFieldType(t: CollectionFieldType): string {
  switch (t) {
    case "text":
      return "text";
    case "number":
      return "double precision";
    case "boolean":
      return "boolean";
    case "date":
      return "timestamptz";
    case "json":
      return "jsonb";
    default: {
      const _exhaustive: never = t;
      return _exhaustive;
    }
  }
}

/**
 * SQL expression used only when adding a NOT NULL column to a non-empty table
 * (Postgres requires a fill for existing rows). Paired with DROP DEFAULT when
 * `field.defaultValue` is undefined so new inserts still require an app-provided value.
 */
function typeBackfillDefaultExpression(type: CollectionFieldType): string {
  switch (type) {
    case "text":
      return "''::text";
    case "number":
      return "0::double precision";
    case "boolean":
      return "false";
    case "date":
      return "now()";
    case "json":
      return "'{}'::jsonb";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function formatColumnDefault(field: CollectionFieldDefinition): string | null {
  if (field.defaultValue === undefined) {
    return null;
  }
  const { type, defaultValue } = field;
  switch (type) {
    case "text":
      return typeof defaultValue === "string" ? formatSqlStringLiteral(defaultValue) : null;
    case "number":
      return typeof defaultValue === "number" && Number.isFinite(defaultValue) ? String(defaultValue) : null;
    case "boolean":
      return typeof defaultValue === "boolean" ? (defaultValue ? "true" : "false") : null;
    case "date":
      return typeof defaultValue === "string" && !Number.isNaN(Date.parse(defaultValue))
        ? `${formatSqlStringLiteral(defaultValue)}::timestamptz`
        : null;
    case "json":
      return defaultValue !== null && typeof defaultValue === "object"
        ? `${formatSqlStringLiteral(JSON.stringify(defaultValue))}::jsonb`
        : null;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Column type, nullability, and default only (no UNIQUE — use named constraints). */
function buildColumnDefinitionBase(field: CollectionFieldDefinition): string {
  assertSafeSqlIdentifier(field.name);
  const pgType = pgTypeForFieldType(field.type);
  const parts: string[] = [`${field.name} ${pgType}`];
  parts.push(field.required ? "NOT NULL" : "NULL");
  const d = formatColumnDefault(field);
  if (d !== null) {
    parts.push(`DEFAULT ${d}`);
  }
  return parts.join(" ");
}

/**
 * ALTER TABLE … ADD COLUMN statements for a new field when the physical table may already have rows.
 * Postgres rejects `ADD … NOT NULL` without DEFAULT on populated tables; unique + constant defaults also collide.
 */
export function buildAddColumnStatementsForExistingTable(
  table: string,
  field: CollectionFieldDefinition,
  rowCount: number,
): string[] {
  assertSafeSqlIdentifier(table);
  assertSafeSqlIdentifier(field.name);
  const pgType = pgTypeForFieldType(field.type);
  const col = field.name;

  if (rowCount === 0) {
    return [`ALTER TABLE ${table} ADD COLUMN ${buildColumnDefinitionBase(field)}`];
  }

  const userDefault = formatColumnDefault(field);

  if (field.required && userDefault !== null && field.unique && rowCount > 1) {
    throw new Error(
      `Cannot add required unique field "${col}" with a constant default while the table has ${rowCount} rows. ` +
        "Add the column as optional, set distinct values per row, then enable unique and required (or use a per-row migration).",
    );
  }

  if (!field.required) {
    const parts: string[] = [`${col} ${pgType} NULL`];
    if (userDefault !== null) {
      parts.push(`DEFAULT ${userDefault}`);
    }
    return [`ALTER TABLE ${table} ADD COLUMN ${parts.join(" ")}`];
  }

  if (userDefault !== null) {
    return [`ALTER TABLE ${table} ADD COLUMN ${col} ${pgType} NOT NULL DEFAULT ${userDefault}`];
  }

  if (!field.unique) {
    const fill = typeBackfillDefaultExpression(field.type);
    return [
      `ALTER TABLE ${table} ADD COLUMN ${col} ${pgType} NOT NULL DEFAULT ${fill}`,
      `ALTER TABLE ${table} ALTER COLUMN ${col} DROP DEFAULT`,
    ];
  }

  if (field.type === "boolean" && rowCount > 2) {
    throw new Error(
      `Cannot add required unique boolean field "${col}": a boolean column allows at most two distinct values, ` +
        `but the table has ${rowCount} rows.`,
    );
  }

  const stmts: string[] = [`ALTER TABLE ${table} ADD COLUMN ${col} ${pgType} NULL`];

  let assignExpr: string;
  switch (field.type) {
    case "text":
      assignExpr = "gen_random_uuid()::text";
      break;
    case "number":
      assignExpr = "n.rn::double precision";
      break;
    case "boolean":
      assignExpr = "(n.rn = 1)";
      break;
    case "date":
      assignExpr = "('epoch'::timestamptz + (n.rn * interval '1 microsecond'))";
      break;
    case "json":
      assignExpr = "to_jsonb(gen_random_uuid()::text)";
      break;
    default: {
      const _exhaustive: never = field.type;
      return _exhaustive;
    }
  }

  stmts.push(`WITH numbered AS (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM ${table})
UPDATE ${table} t SET ${col} = ${assignExpr}
FROM numbered n WHERE t.id = n.id AND t.${col} IS NULL`);
  stmts.push(`ALTER TABLE ${table} ALTER COLUMN ${col} SET NOT NULL`);

  return stmts;
}

function buildCreateTableSql(tableSuffix: string, fields: CollectionFieldDefinition[]): string {
  assertValidTableSuffix(tableSuffix);
  const table = collectionDataTableName(tableSuffix);
  const lines: string[] = [
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
    "created_by text NULL",
    "updated_by text NULL",
  ];
  for (const f of fields) {
    lines.push(buildColumnDefinitionBase(f));
    if (f.unique) {
      lines.push(`CONSTRAINT ${uniqueConstraintName(tableSuffix, f.name)} UNIQUE (${f.name})`);
    }
  }
  return `CREATE TABLE ${table} (\n  ${lines.join(",\n  ")}\n)`;
}

function typeChangeUsingExpression(from: CollectionFieldType, to: CollectionFieldType, column: string): string | null {
  if (from === to) {
    return null;
  }
  if (from === "text" && to === "json") {
    return `${column}::jsonb`;
  }
  if (from === "number" && to === "text") {
    return `${column}::text`;
  }
  if (from === "boolean" && to === "text") {
    return `${column}::text`;
  }
  if (from === "date" && to === "text") {
    return `${column}::text`;
  }
  if (from === "text" && to === "number") {
    return `${column}::double precision`;
  }
  if (from === "text" && to === "boolean") {
    return `${column}::boolean`;
  }
  if (from === "text" && to === "date") {
    return `${column}::timestamptz`;
  }
  if (from === "number" && to === "json") {
    return `to_jsonb(${column})`;
  }
  if (from === "boolean" && to === "json") {
    return `to_jsonb(${column})`;
  }
  if (from === "date" && to === "json") {
    return `to_jsonb(${column})`;
  }
  if (from === "json" && to === "text") {
    return `${column}::text`;
  }
  if (from === "json" && to === "number") {
    return `((${column} #>> '{}')::double precision)`;
  }
  if (from === "json" && to === "boolean") {
    return `((${column} #>> '{}')::boolean)`;
  }
  if (from === "json" && to === "date") {
    return `((${column} #>> '{}')::timestamptz)`;
  }
  if (from === "number" && to === "boolean") {
    return `${column}::boolean`;
  }
  if (from === "number" && to === "date") {
    return `to_timestamp(${column})`;
  }
  if (from === "boolean" && to === "number") {
    return `${column}::int::double precision`;
  }
  if (from === "boolean" && to === "date") {
    return null;
  }
  if (from === "date" && to === "number") {
    return `extract(epoch from ${column})`;
  }
  if (from === "date" && to === "boolean") {
    return null;
  }
  return null;
}

export async function collectionDataTableExists(executor: SqlExecutor, tableSuffix: string): Promise<boolean> {
  const rel = collectionDataTableName(tableSuffix);
  const result = await executor.execute(sql`SELECT to_regclass(${rel}::text) IS NOT NULL AS ok`);
  const row = rowsFromPgExecute<{ ok: boolean }>(result)[0];
  return Boolean(row?.ok);
}

export async function createCollectionDataTable(
  executor: SqlExecutor,
  tableSuffix: string,
  fields: CollectionFieldDefinition[],
): Promise<void> {
  const stmt = buildCreateTableSql(tableSuffix, fields);
  await executor.execute(sql.raw(stmt));
}

export async function dropCollectionDataTable(executor: SqlExecutor, tableSuffix: string): Promise<void> {
  const table = collectionDataTableName(tableSuffix);
  await executor.execute(sql.raw(`DROP TABLE IF EXISTS ${table}`));
}

/**
 * Migrate physical columns from `previous` field defs to `next` (same order as metadata).
 */
export async function syncCollectionDataTableSchema(
  executor: SqlExecutor,
  tableSuffix: string,
  previous: CollectionFieldDefinition[],
  next: CollectionFieldDefinition[],
): Promise<void> {
  const table = collectionDataTableName(tableSuffix);
  await executor.execute(
    sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`),
  );
  await executor.execute(
    sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`),
  );
  await executor.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_by text NULL`));
  await executor.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_by text NULL`));
  const prevById = new Map(previous.map((f) => [f.id, f]));
  const nextIds = new Set(next.map((f) => f.id));
  const newFieldDefs = next.filter((n) => !prevById.has(n.id));

  let existingRowCount = 0;
  if (newFieldDefs.length > 0) {
    const countRes = await executor.execute(sql.raw(`SELECT COUNT(*)::bigint AS c FROM ${table}`));
    const row = rowsFromPgExecute<{ c: string | bigint | number }>(countRes)[0];
    existingRowCount = Number(row?.c ?? 0);
  }

  const statements: string[] = [];

  for (const p of previous) {
    if (!nextIds.has(p.id)) {
      assertSafeSqlIdentifier(p.name);
      if (p.unique) {
        statements.push(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${uniqueConstraintName(tableSuffix, p.name)}`);
      }
      statements.push(`ALTER TABLE ${table} DROP COLUMN IF EXISTS ${p.name}`);
    }
  }

  for (const n of next) {
    const p = prevById.get(n.id);
    if (p && p.name !== n.name) {
      assertSafeSqlIdentifier(p.name);
      assertSafeSqlIdentifier(n.name);
      if (p.unique) {
        statements.push(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${uniqueConstraintName(tableSuffix, p.name)}`);
      }
      statements.push(`ALTER TABLE ${table} RENAME COLUMN ${p.name} TO ${n.name}`);
      if (n.unique) {
        statements.push(
          `ALTER TABLE ${table} ADD CONSTRAINT ${uniqueConstraintName(tableSuffix, n.name)} UNIQUE (${n.name})`,
        );
      }
    }
  }

  for (const n of next) {
    const p = prevById.get(n.id);
    if (!p) {
      continue;
    }
    const currentName = n.name;
    assertSafeSqlIdentifier(currentName);
    if (p.type !== n.type) {
      const using = typeChangeUsingExpression(p.type, n.type, currentName);
      if (!using) {
        throw new Error(`Unsupported Postgres type migration ${p.type} -> ${n.type} for column "${currentName}".`);
      }
      const newPg = pgTypeForFieldType(n.type);
      statements.push(`ALTER TABLE ${table} ALTER COLUMN ${currentName} TYPE ${newPg} USING ${using}`);
    }
    const nullSql =
      n.required && !p.required
        ? `ALTER TABLE ${table} ALTER COLUMN ${currentName} SET NOT NULL`
        : !n.required && p.required
          ? `ALTER TABLE ${table} ALTER COLUMN ${currentName} DROP NOT NULL`
          : null;
    if (nullSql) {
      statements.push(nullSql);
    }
    if (p.name === n.name && p.unique !== n.unique) {
      const uq = uniqueConstraintName(tableSuffix, currentName);
      if (n.unique) {
        statements.push(`ALTER TABLE ${table} ADD CONSTRAINT ${uq} UNIQUE (${currentName})`);
      } else {
        statements.push(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${uq}`);
      }
    }
  }

  for (const n of next) {
    if (!prevById.has(n.id)) {
      const addStmts = buildAddColumnStatementsForExistingTable(table, n, existingRowCount);
      statements.push(...addStmts);
      if (n.unique) {
        statements.push(
          `ALTER TABLE ${table} ADD CONSTRAINT ${uniqueConstraintName(tableSuffix, n.name)} UNIQUE (${n.name})`,
        );
      }
    }
  }

  for (const stmt of statements) {
    await executor.execute(sql.raw(stmt));
  }
}
