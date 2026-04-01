import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RecordForm } from "@/app/collections/[collectionId]/records/record-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { db, collections } from "@/db";
import { parseCollectionFields } from "@/lib/collection-fields";
import { formatRecordActorLabel, formatRecordAuditTimestamp } from "@/lib/collection-record-audit";
import { getMemberFromHeaders, isAdminOrOwner } from "@/lib/member";
import { getCollectionRecord, loadCollectionRecordsTarget } from "@/server/collection-records";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ collectionId: string; recordId: string }> };

export default async function EditCollectionRecordPage(props: Props) {
  const member = await getMemberFromHeaders(await headers());
  if (!member) {
    redirect("/login");
  }
  if (!isAdminOrOwner(member)) {
    redirect("/");
  }

  const { collectionId, recordId } = await props.params;

  const [row] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (!row) {
    notFound();
  }

  const target = await loadCollectionRecordsTarget(collectionId);
  if (!target) {
    notFound();
  }

  const record = await getCollectionRecord(target, recordId);
  if (!record) {
    notFound();
  }

  const fields = parseCollectionFields(row.fields);
  const fieldNames = new Set(fields.map((f) => f.name));
  const initialValues = Object.fromEntries(
    Object.entries(record)
      .filter(([k]) => fieldNames.has(k))
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Edit record · {row.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{recordId}</p>
      </div>
      <section
        aria-label="Record audit metadata"
        className="border-border bg-muted/20 max-w-xl rounded-lg border px-4 py-3 text-sm"
      >
        <h2 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">Audit</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Created</dt>
            <dd className="font-mono text-xs">{formatRecordAuditTimestamp(record.created_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Updated</dt>
            <dd className="font-mono text-xs">{formatRecordAuditTimestamp(record.updated_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Created by</dt>
            <dd className="break-all font-mono text-xs">{formatRecordActorLabel(record.created_by)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Updated by</dt>
            <dd className="break-all font-mono text-xs">{formatRecordActorLabel(record.updated_by)}</dd>
          </div>
        </dl>
      </section>
      <RecordForm
        key={recordId}
        collectionId={collectionId}
        fields={fields}
        mode="edit"
        recordId={recordId}
        initialValues={initialValues}
      />
      <Link
        href={`/collections/${collectionId}/records`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}
      >
        ← Back to records
      </Link>
    </main>
  );
}
