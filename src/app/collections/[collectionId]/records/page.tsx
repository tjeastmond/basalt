import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RecordsList } from "@/app/collections/[collectionId]/records/records-list";
import { buttonVariants } from "@/components/ui/button-variants";
import { db, collections } from "@/db";
import { parseCollectionFields } from "@/lib/collection-fields";
import { getMemberFromHeaders, isAdminOrOwner } from "@/lib/member";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ collectionId: string }> };

export default async function CollectionRecordsPage(props: Props) {
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{row.name}</h1>
          <p className="text-sm text-muted-foreground">
            Records in <span className="font-mono text-xs">{row.slug}</span> · physical table{" "}
            <span className="font-mono text-xs">col_{row.tableSuffix}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/collections/${collectionId}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Edit schema
          </Link>
          <Link href="/collections" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            All collections
          </Link>
        </div>
      </div>
      <RecordsList collectionId={collectionId} fields={fields} />
    </main>
  );
}
