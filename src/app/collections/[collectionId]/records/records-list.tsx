"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

type Props = {
  collectionId: string;
  fields: CollectionFieldDefinition[];
};

export function RecordsList(props: Props) {
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");

  const pageSize = 25;

  const queryInput = useMemo(
    () => ({
      collectionId: props.collectionId,
      page,
      pageSize,
      search: searchApplied.trim().length > 0 ? searchApplied.trim() : undefined,
    }),
    [props.collectionId, page, pageSize, searchApplied],
  );

  const { data, isPending, error } = trpc.records.list.useQuery(queryInput);

  const tableFields = props.fields.slice(0, 5);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Search (text fields)</span>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="border-input min-w-[12rem] rounded-md border px-3 py-2 text-sm"
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
        </div>
        <Link
          href={`/collections/${props.collectionId}/records/new`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
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
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">id</th>
                {tableFields.map((f) => (
                  <th key={f.id} className="px-3 py-2 font-medium">
                    {humanizeFieldMachineName(f.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const id = String(row.id ?? "");
                return (
                  <tr key={id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/collections/${props.collectionId}/records/${id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {id.slice(0, 8)}…
                      </Link>
                    </td>
                    {tableFields.map((f) => (
                      <td key={f.id} className="max-w-[14rem] truncate px-3 py-2">
                        {formatCellValue(row[f.name])}
                      </td>
                    ))}
                  </tr>
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
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
