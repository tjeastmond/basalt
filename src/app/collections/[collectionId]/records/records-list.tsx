"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { FieldInput, parseFieldInput, valueToInput } from "@/app/collections/[collectionId]/records/record-form";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { humanizeFieldMachineName, type CollectionFieldDefinition } from "@/lib/collection-fields";
import { trpc } from "@/trpc/react";

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatCreatedAt(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  if (typeof value === "string") {
    return value.slice(0, 19).replace("T", " ");
  }
  return String(value);
}

type Props = {
  collectionId: string;
  fields: CollectionFieldDefinition[];
};

function RecordInlineEditor(props: {
  collectionId: string;
  fields: CollectionFieldDefinition[];
  recordId: string;
  row: Record<string, unknown>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const f of props.fields) {
      m[f.name] = valueToInput(f, props.row[f.name]);
    }
    return m;
  });
  const [formError, setFormError] = useState<string | null>(null);

  const updateMut = trpc.records.update.useMutation({
    onSuccess: async () => {
      await utils.records.list.invalidate();
      props.onSaved();
    },
    onError: (e) => setFormError(e.message),
  });

  function buildValues(): Record<string, unknown> | null {
    const out: Record<string, unknown> = {};
    for (const f of props.fields) {
      const raw = inputs[f.name] ?? "";
      const parsed = parseFieldInput(f, raw);
      if (!parsed.ok) {
        setFormError(parsed.message);
        return null;
      }
      if (parsed.value === undefined && raw.trim() === "") {
        continue;
      }
      if (parsed.value !== undefined) {
        out[f.name] = parsed.value;
      }
    }
    setFormError(null);
    return out;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">Edit inline — same validation as the full record form.</p>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">No custom fields on this collection.</p>
        ) : (
          props.fields.map((f) => (
            <FieldInput
              key={f.id}
              field={f}
              value={inputs[f.name] ?? ""}
              onChange={(v) => setInputs((prev) => ({ ...prev, [f.name]: v }))}
              disabled={updateMut.isPending}
            />
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={updateMut.isPending}
          onClick={() => {
            const values = buildValues();
            if (!values) {
              return;
            }
            void updateMut.mutateAsync({
              collectionId: props.collectionId,
              id: props.recordId,
              values,
            });
          }}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={updateMut.isPending} onClick={props.onCancel}>
          Cancel
        </Button>
        <Link
          href={`/collections/${props.collectionId}/records/${props.recordId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Open full edit page
        </Link>
      </div>
    </div>
  );
}

export function RecordsList(props: Props) {
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingId, setEditingId] = useState<string | null>(null);

  const pageSize = 25;

  const queryInput = useMemo(
    () => ({
      collectionId: props.collectionId,
      page,
      pageSize,
      search: searchApplied.trim().length > 0 ? searchApplied.trim() : undefined,
      sortBy,
      sortDir,
    }),
    [props.collectionId, page, pageSize, searchApplied, sortBy, sortDir],
  );

  const { data, isPending, error } = trpc.records.list.useQuery(queryInput);

  const tableFields = props.fields.slice(0, 5);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const colCount = 2 + tableFields.length;

  const sortOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "created_at", label: "Created" },
      { value: "updated_at", label: "Updated" },
      { value: "id", label: "id" },
    ];
    for (const f of props.fields) {
      opts.push({ value: f.name, label: humanizeFieldMachineName(f.name) });
    }
    return opts;
  }, [props.fields]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Search (text fields)</span>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="border-input min-w-48 rounded-md border px-3 py-2 text-sm"
              placeholder="Contains…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearchApplied(searchDraft);
                  setPage(1);
                }
              }}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setSearchApplied(searchDraft);
              setPage(1);
            }}
          >
            Search
          </Button>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="border-input min-w-40 rounded-md border px-3 py-2 text-sm"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Direction</span>
            <select
              value={sortDir}
              onChange={(e) => {
                setSortDir(e.target.value as "asc" | "desc");
                setPage(1);
              }}
              className="border-input rounded-md border px-3 py-2 text-sm"
            >
              <option value="desc">Newest / high first</option>
              <option value="asc">Oldest / low first</option>
            </select>
          </label>
        </div>
        <Link href={`/collections/${props.collectionId}/records/new`} className={cn(buttonVariants({ size: "sm" }))}>
          New record
        </Link>
      </div>

      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading records…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No records yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-lg border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">id</th>
                <th className="px-3 py-2 font-medium">Created</th>
                {tableFields.map((f) => (
                  <th key={f.id} className="px-3 py-2 font-medium">
                    {humanizeFieldMachineName(f.name)}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const id = String(row.id ?? "");
                return (
                  <Fragment key={id}>
                    <tr className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/collections/${props.collectionId}/records/${id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                        {formatCreatedAt(row.created_at)}
                      </td>
                      {tableFields.map((f) => (
                        <td key={f.id} className="max-w-56 truncate px-3 py-2">
                          {formatCellValue(row[f.name])}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId((cur) => (cur === id ? null : id))}
                        >
                          {editingId === id ? "Close" : "Edit inline"}
                        </Button>
                      </td>
                    </tr>
                    {editingId === id ? (
                      <tr className="border-b border-border bg-muted/15">
                        <td colSpan={colCount + 1} className="px-3 py-4">
                          <RecordInlineEditor
                            key={id}
                            collectionId={props.collectionId}
                            fields={props.fields}
                            recordId={id}
                            row={row}
                            onCancel={() => setEditingId(null)}
                            onSaved={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {data.total} record{data.total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
