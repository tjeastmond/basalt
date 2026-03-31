import Link from "next/link";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CollectionEditor } from "@/app/collections/collection-editor";
import { db, user } from "@/db";
import { getMemberFromHeaders, isAdminOrOwner } from "@/lib/member";

export default async function NewCollectionPage() {
  const member = await getMemberFromHeaders(await headers());
  if (!member) {
    redirect("/login");
  }
  if (!isAdminOrOwner(member)) {
    redirect("/");
  }

  if (!member.onboardingCompletedAt) {
    await db.update(user).set({ onboardingCompletedAt: new Date() }).where(eq(user.id, member.userId));
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">New collection</h1>
        <p className="text-sm text-muted-foreground">
          Choose a slug and add fields. You can start with an empty field list and iterate later.
        </p>
      </div>
      <CollectionEditor mode="create" onCancelHref="/collections" />
      <p className="text-center text-sm">
        <Link href="/" className="text-foreground underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
