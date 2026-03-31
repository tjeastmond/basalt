import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RecordForm } from "@/app/collections/[collectionId]/records/record-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { db, collections } from "@/db";
import { parseCollectionFields } from "@/lib/collection-fields";
import { getMemberFromHeaders, isAdminOrOwner } from "@/lib/member";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ collectionId: string }> };

export default async function NewCollectionRecordPage(props: Props) {
  const member = await getMemberFromHeaders(await headers());
  if (!member) {
    redirect("/login");
  }
  if (!isAdminOrOwner(member)) {
    redirect("/");
  }

  const { collectionId } = await props.params;

  const [row] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (!row) {
    notFound();
  }

  const fields = parseCollectionFields(row.fields);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">New record · {row.name}</h1>
        <p className="text-sm text-muted-foreground">
          Values are validated before insert into the collection data table.
        </p>
      </div>
      <RecordForm key="new" collectionId={collectionId} fields={fields} mode="create" />
      <Link
        href={`/collections/${collectionId}/records`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}
      >
        ← Back to records
      </Link>
    </main>
  );
}
