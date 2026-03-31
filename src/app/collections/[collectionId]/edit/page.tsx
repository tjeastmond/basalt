import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CollectionEditor } from "@/app/collections/collection-editor";
import { db, collections } from "@/db";
import { parseCollectionFields } from "@/lib/collection-fields";
import { getMemberFromHeaders, isAdminOrOwner } from "@/lib/member";

type Props = { params: Promise<{ collectionId: string }> };

export default async function EditCollectionPage(props: Props) {
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
  const initial = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    fields,
    updatedAt: row.updatedAt.toISOString(),
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Edit collection</h1>
        <p className="text-sm text-muted-foreground">
          Renames use stable field ids. Removing fields or unsafe type changes require an extra confirmation step.
        </p>
      </div>
      <CollectionEditor
        key={initial.updatedAt}
        mode="edit"
        collectionId={collectionId}
        initial={initial}
        onCancelHref="/collections"
      />
    </main>
  );
}
