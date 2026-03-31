"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react";

export function CollectionsList() {
  const { data, isPending, error } = trpc.collections.list.useQuery();

  if (isPending) {
    return <p className="text-muted-foreground text-sm">Loading collections…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const rows = data?.collections ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Schemas are stored as metadata and applied at runtime—no per-collection SQL migrations.
        </p>
        <Link href="/collections/new" className={cn(buttonVariants({ size: "sm" }))}>
          New collection
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No collections yet.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/collections/${c.id}/edit`}
                className="min-w-0 flex-1 cursor-pointer rounded-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground text-xs">{c.slug}</p>
              </Link>
              <Link
                href={`/collections/${c.id}/records`}
                className="text-primary shrink-0 text-sm underline-offset-4 hover:underline"
              >
                Records
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
