"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
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
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground text-xs">{c.slug}</p>
              </div>
              <Link
                href={`/collections/${c.id}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
