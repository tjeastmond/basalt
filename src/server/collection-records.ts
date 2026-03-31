import { eq } from "drizzle-orm";

import { collections, db, getPool } from "@/db";
import type { CollectionFieldDefinition } from "@/lib/collection-fields";
import { parseCollectionFields } from "@/lib/collection-fields";
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

  const fields = parseCollectionFields(row.fields);
  const tableSql = collectionDataTableName(row.tableSuffix);
  return {
    collectionId: row.id,
    tableSuffix: row.tableSuffix,
    tableSql,
    fields,
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

    const coerced = coerceFieldValue(field, raw, !field.required);
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
    const field = assertKnownFieldName(fields, key);
    const raw = input[key];
    if (raw === undefined) {
      continue;
    }
    const coerced = coerceFieldValue(field, raw, !field.required);
    columns.push(field.name);
    values.push(coerced);
  }

  return { columns, values };
}

function selectColumnList(fields: CollectionFieldDefinition[]): string {
  const parts = ["id"];
  for (const f of fields) {
    assertSafeSqlIdentifier(f.name);
    parts.push(f.name);
  }
  return parts.join(", ");
}

export type ListCollectionRecordsParams = {
  limit: number;
  offset: number;
  search?: string;
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
  const listSql = `SELECT ${cols} FROM ${target.tableSql} ${whereSql} ORDER BY id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

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
): Promise<Record<string, unknown>> {
  const { columns, values } = buildInsertColumns(target.fields, input);
  if (columns.length === 0) {
    const pool = getPool();
    const sql = `INSERT INTO ${target.tableSql} DEFAULT VALUES RETURNING ${selectColumnList(target.fields)}`;
    const res = await pool.query<Record<string, unknown>>(sql);
    const row = res.rows[0];
    if (!row) {
      throw new RecordValidationError("Insert returned no row.");
    }
    return row;
  }

  const pool = getPool();
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const sql = `INSERT INTO ${target.tableSql} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${selectColumnList(target.fields)}`;
  const res = await pool.query<Record<string, unknown>>(sql, values);
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
): Promise<Record<string, unknown> | null> {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) {
    return null;
  }
  const { columns, values } = buildUpdateColumns(target.fields, input);
  if (columns.length === 0) {
    return getCollectionRecord(target, recordId);
  }

  const pool = getPool();
  const setParts = columns.map((c, i) => `${c} = $${i + 1}`);
  const nextIdx = values.length + 1;
  const sql = `UPDATE ${target.tableSql} SET ${setParts.join(", ")} WHERE id = $${nextIdx}::uuid RETURNING ${selectColumnList(target.fields)}`;
  const res = await pool.query<Record<string, unknown>>(sql, [...values, recordId]);
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
