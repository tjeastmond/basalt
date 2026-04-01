import { eq } from "drizzle-orm";

import { collections, db, getPool } from "@/db";
import type { CollectionApiPermissions } from "@/lib/collection-api-permissions";
import { normalizeCollectionApiPermissions } from "@/lib/collection-api-permissions";
import type { CollectionFieldDefinition } from "@/lib/collection-fields";
import {
  parseCollectionFields,
  RESERVED_COLLECTION_FIELD_NAMES,
  validateValueAgainstFieldConstraints,
} from "@/lib/collection-fields";
import { escapeIlikePattern } from "@/lib/ilike-escape";
import { assertSafeSqlIdentifier, collectionDataTableName } from "@/lib/collection-physical-table";

export class RecordValidationError extends Error {
  override readonly name = "RecordValidationError";

  constructor(message: string) {
    super(message);
  }
}

export type CollectionRecordsTarget = {
  collectionId: string;
  tableSuffix: string;
  tableSql: string;
  fields: CollectionFieldDefinition[];
};

export type CollectionRecordsTargetWithApi = CollectionRecordsTarget & {
  slug: string;
  apiPermissions: CollectionApiPermissions;
};

/** Who performed a record write; stored in `created_by` / `updated_by` on the physical row. */
export type CollectionRecordActor = { kind: "user"; userId: string } | { kind: "api_key"; apiKeyId: string };

function collectionRecordActorRef(actor: CollectionRecordActor): string {
  return actor.kind === "user" ? actor.userId : `api_key:${actor.apiKeyId}`;
}

function assertInputHasNoSystemOwnedKeys(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    if (RESERVED_COLLECTION_FIELD_NAMES.has(key)) {
      throw new RecordValidationError(`Cannot set system field "${key}" via the API.`);
    }
  }
}

export async function loadCollectionRecordsTarget(collectionId: string): Promise<CollectionRecordsTarget | null> {
  const [row] = await db
    .select({
      id: collections.id,
      tableSuffix: collections.tableSuffix,
      fields: collections.fields,
    })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!row) {
    return null;
  }

  await ensurePhysicalAuditColumns(row.tableSuffix);

  const fields = parseCollectionFields(row.fields);
  const tableSql = collectionDataTableName(row.tableSuffix);
  return {
    collectionId: row.id,
    tableSuffix: row.tableSuffix,
    tableSql,
    fields,
  };
}

export async function loadCollectionTargetWithApiBySlug(slug: string): Promise<CollectionRecordsTargetWithApi | null> {
  const [row] = await db
    .select({
      id: collections.id,
      slug: collections.slug,
      tableSuffix: collections.tableSuffix,
      fields: collections.fields,
      apiPermissions: collections.apiPermissions,
    })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  if (!row) {
    return null;
  }

  await ensurePhysicalAuditColumns(row.tableSuffix);

  const fields = parseCollectionFields(row.fields);
  const tableSql = collectionDataTableName(row.tableSuffix);
  return {
    collectionId: row.id,
    tableSuffix: row.tableSuffix,
    tableSql,
    fields,
    slug: row.slug,
    apiPermissions: normalizeCollectionApiPermissions(row.apiPermissions),
  };
}

function assertKnownFieldName(fields: CollectionFieldDefinition[], name: string): CollectionFieldDefinition {
  assertSafeSqlIdentifier(name);
  const field = fields.find((f) => f.name === name);
  if (!field) {
    throw new RecordValidationError(`Unknown field "${name}".`);
  }
  return field;
}

async function ensurePhysicalAuditColumns(tableSuffix: string): Promise<void> {
  const pool = getPool();
  const table = collectionDataTableName(tableSuffix);
  await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`);
  await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`);
  await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_by text NULL`);
  await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_by text NULL`);
}

function coerceFieldValue(field: CollectionFieldDefinition, raw: unknown, allowNull: boolean): unknown {
  if (raw === null) {
    if (!allowNull) {
      throw new RecordValidationError(`Field "${field.name}" cannot be null.`);
    }
    return null;
  }

  switch (field.type) {
    case "text": {
      if (typeof raw !== "string") {
        throw new RecordValidationError(`Field "${field.name}" must be a string.`);
      }
      return raw;
    }
    case "number": {
      if (typeof raw === "number") {
        if (!Number.isFinite(raw)) {
          throw new RecordValidationError(`Field "${field.name}" must be a finite number.`);
        }
        return raw;
      }
      if (typeof raw === "string" && raw.trim() !== "") {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          throw new RecordValidationError(`Field "${field.name}" must be a finite number.`);
        }
        return n;
      }
      throw new RecordValidationError(`Field "${field.name}" must be a finite number.`);
    }
    case "boolean": {
      if (typeof raw !== "boolean") {
        throw new RecordValidationError(`Field "${field.name}" must be a boolean.`);
      }
      return raw;
    }
    case "date": {
      if (raw instanceof Date) {
        if (Number.isNaN(raw.getTime())) {
          throw new RecordValidationError(`Field "${field.name}" must be a valid date.`);
        }
        return raw;
      }
      if (typeof raw === "string") {
        const t = Date.parse(raw);
        if (Number.isNaN(t)) {
          throw new RecordValidationError(`Field "${field.name}" must be a parseable date (ISO-8601).`);
        }
        return new Date(t);
      }
      throw new RecordValidationError(`Field "${field.name}" must be a date or ISO-8601 string.`);
    }
    case "json": {
      if (raw !== null && typeof raw === "object") {
        return raw;
      }
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          throw new RecordValidationError(`Field "${field.name}" must be valid JSON.`);
        }
      }
      throw new RecordValidationError(`Field "${field.name}" must be a JSON object, array, or JSON string.`);
    }
    default: {
      const _exhaustive: never = field.type;
      return _exhaustive;
    }
  }
}

function coerceAndValidateFieldValue(field: CollectionFieldDefinition, raw: unknown, allowNull: boolean): unknown {
  const coerced = coerceFieldValue(field, raw, allowNull);
  const msg = validateValueAgainstFieldConstraints(field, coerced);
  if (msg) {
    throw new RecordValidationError(msg);
  }
  return coerced;
}

function buildInsertColumns(
  fields: CollectionFieldDefinition[],
  input: Record<string, unknown>,
): { columns: string[]; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const field of fields) {
    const hasKey = Object.prototype.hasOwnProperty.call(input, field.name);
    const raw = hasKey ? input[field.name] : undefined;

    if (!hasKey || raw === undefined) {
      if (field.required && field.defaultValue === undefined) {
        throw new RecordValidationError(`Missing required field "${field.name}".`);
      }
      continue;
    }

    const coerced = coerceAndValidateFieldValue(field, raw, !field.required);
    assertSafeSqlIdentifier(field.name);
    columns.push(field.name);
    values.push(coerced);
  }

  return { columns, values };
}

function buildUpdateColumns(
  fields: CollectionFieldDefinition[],
  input: Record<string, unknown>,
): { columns: string[]; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const key of Object.keys(input)) {
    if (key === "id") {
      throw new RecordValidationError('Cannot update "id".');
    }
    if (RESERVED_COLLECTION_FIELD_NAMES.has(key)) {
      throw new RecordValidationError(`Cannot set system field "${key}" via the API.`);
    }
    const field = assertKnownFieldName(fields, key);
    const raw = input[key];
    if (raw === undefined) {
      continue;
    }
    const coerced = coerceAndValidateFieldValue(field, raw, !field.required);
    columns.push(field.name);
    values.push(coerced);
  }

  return { columns, values };
}

function selectColumnList(fields: CollectionFieldDefinition[]): string {
  const parts = ["id", "created_at", "updated_at", "created_by", "updated_by"];
  for (const f of fields) {
    assertSafeSqlIdentifier(f.name);
    parts.push(f.name);
  }
  return parts.join(", ");
}

export type ListCollectionRecordsSortDir = "asc" | "desc";

function buildOrderBySql(
  target: CollectionRecordsTarget,
  sortByInput: string | undefined,
  sortDir: ListCollectionRecordsSortDir,
): string {
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const raw = (sortByInput?.trim().toLowerCase() || "created_at").slice(0, 64);
  const primary = raw.length > 0 ? raw : "created_at";

  if (primary === "id") {
    assertSafeSqlIdentifier("id");
    return `ORDER BY id ${dir}`;
  }
  if (primary === "created_at") {
    assertSafeSqlIdentifier("created_at");
    return `ORDER BY created_at ${dir} NULLS LAST, id DESC`;
  }
  if (primary === "updated_at") {
    assertSafeSqlIdentifier("updated_at");
    return `ORDER BY updated_at ${dir} NULLS LAST, id DESC`;
  }

  const field = target.fields.find((f) => f.name === primary);
  if (!field) {
    throw new RecordValidationError(`Unknown sort field "${sortByInput ?? ""}".`);
  }
  assertSafeSqlIdentifier(field.name);
  return `ORDER BY ${field.name} ${dir} NULLS LAST, id DESC`;
}

export type ListCollectionRecordsParams = {
  limit: number;
  offset: number;
  search?: string;
  sortBy?: string;
  sortDir?: ListCollectionRecordsSortDir;
};

export type ListCollectionRecordsResult = {
  rows: Record<string, unknown>[];
  total: number;
};

export async function listCollectionRecords(
  target: CollectionRecordsTarget,
  params: ListCollectionRecordsParams,
): Promise<ListCollectionRecordsResult> {
  const pool = getPool();
  const cols = selectColumnList(target.fields);
  const textFields = target.fields.filter((f) => f.type === "text");

  const queryParams: unknown[] = [];
  let whereSql = "";

  const trimmedSearch = params.search?.trim() ?? "";
  if (trimmedSearch.length > 0 && textFields.length > 0) {
    const pattern = `%${escapeIlikePattern(trimmedSearch)}%`;
    queryParams.push(pattern);
    const p = `$${queryParams.length}`;
    const clauses = textFields.map((f) => {
      assertSafeSqlIdentifier(f.name);
      return `${f.name} ILIKE ${p} ESCAPE '\\'`;
    });
    whereSql = `WHERE (${clauses.join(" OR ")})`;
  }

  queryParams.push(params.limit, params.offset);
  const limitIdx = queryParams.length - 1;
  const offsetIdx = queryParams.length;
  const orderSql = buildOrderBySql(target, params.sortBy, params.sortDir ?? "desc");
  const listSql = `SELECT ${cols} FROM ${target.tableSql} ${whereSql} ${orderSql} LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

  const countSql = `SELECT count(*)::int AS c FROM ${target.tableSql} ${whereSql}`;
  const countParams = queryParams.slice(0, queryParams.length - 2);

  const [listRes, countRes] = await Promise.all([
    pool.query<Record<string, unknown>>(listSql, queryParams),
    pool.query<{ c: number }>(countSql, countParams),
  ]);

  const total = countRes.rows[0]?.c ?? 0;
  return { rows: listRes.rows, total };
}

export async function getCollectionRecord(
  target: CollectionRecordsTarget,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) {
    return null;
  }
  const pool = getPool();
  const cols = selectColumnList(target.fields);
  const sql = `SELECT ${cols} FROM ${target.tableSql} WHERE id = $1::uuid LIMIT 1`;
  const res = await pool.query<Record<string, unknown>>(sql, [recordId]);
  return res.rows[0] ?? null;
}

export async function insertCollectionRecord(
  target: CollectionRecordsTarget,
  input: Record<string, unknown>,
  actor: CollectionRecordActor,
): Promise<Record<string, unknown>> {
  assertInputHasNoSystemOwnedKeys(input);
  const actorRef = collectionRecordActorRef(actor);
  const { columns, values } = buildInsertColumns(target.fields, input);
  const pool = getPool();
  const returning = selectColumnList(target.fields);

  if (columns.length === 0) {
    const sql = `INSERT INTO ${target.tableSql} (created_by, updated_by) VALUES ($1, $1) RETURNING ${returning}`;
    const res = await pool.query<Record<string, unknown>>(sql, [actorRef]);
    const row = res.rows[0];
    if (!row) {
      throw new RecordValidationError("Insert returned no row.");
    }
    return row;
  }

  const auditIdx = values.length + 1;
  const insertCols = [...columns, "created_by", "updated_by"];
  const placeholders = [...columns.map((_, i) => `$${i + 1}`), `$${auditIdx}`, `$${auditIdx}`];
  const sql = `INSERT INTO ${target.tableSql} (${insertCols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${returning}`;
  const res = await pool.query<Record<string, unknown>>(sql, [...values, actorRef]);
  const row = res.rows[0];
  if (!row) {
    throw new RecordValidationError("Insert returned no row.");
  }
  return row;
}

export async function updateCollectionRecord(
  target: CollectionRecordsTarget,
  recordId: string,
  input: Record<string, unknown>,
  actor: CollectionRecordActor,
): Promise<Record<string, unknown> | null> {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) {
    return null;
  }
  assertInputHasNoSystemOwnedKeys(input);
  const actorRef = collectionRecordActorRef(actor);
  const { columns, values } = buildUpdateColumns(target.fields, input);
  if (columns.length === 0) {
    return getCollectionRecord(target, recordId);
  }

  const pool = getPool();
  const setParts = columns.map((c, i) => `${c} = $${i + 1}`);
  const updatedByIdx = values.length + 1;
  const idIdx = values.length + 2;
  setParts.push("updated_at = now()", `updated_by = $${updatedByIdx}`);
  const sql = `UPDATE ${target.tableSql} SET ${setParts.join(", ")} WHERE id = $${idIdx}::uuid RETURNING ${selectColumnList(target.fields)}`;
  const res = await pool.query<Record<string, unknown>>(sql, [...values, actorRef, recordId]);
  return res.rows[0] ?? null;
}

export async function deleteCollectionRecord(target: CollectionRecordsTarget, recordId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) {
    return false;
  }
  const pool = getPool();
  const sql = `DELETE FROM ${target.tableSql} WHERE id = $1::uuid`;
  const res = await pool.query(sql, [recordId]);
  return res.rowCount !== null && res.rowCount > 0;
}
