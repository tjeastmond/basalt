import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RecordForm } from "@/app/collections/[collectionId]/records/record-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { db, collections } from "@/db";
import { parseCollectionFields } from "@/lib/collection-fields";
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

  const initialValues = Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  );

  const fields = parseCollectionFields(row.fields);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Edit record · {row.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{recordId}</p>
      </div>
      <RecordForm
        key={recordId}
        collectionId={collectionId}
        fields={fields}
        mode="edit"
        recordId={recordId}
        initialValues={initialValues}
      />
      <Link href={`/collections/${collectionId}/records`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}>
        ← Back to records
      </Link>
    </main>
  );
}
