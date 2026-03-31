import Link from "next/link";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db, user } from "@/db";
import { getMemberFromHeaders } from "@/lib/member";

export default async function NewCollectionPage() {
  const member = await getMemberFromHeaders(await headers());
  if (!member) {
    redirect("/login");
  }

  if (!member.onboardingCompletedAt) {
    await db.update(user).set({ onboardingCompletedAt: new Date() }).where(eq(user.id, member.userId));
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Collections</h1>
        <p className="text-sm text-muted-foreground">
          Collection metadata and runtime schema changes are next on the roadmap. For now, use this page as a
          destination from onboarding; the full builder will land in the Collections milestone.
        </p>
      </div>
      <p className="text-center text-sm">
        <Link href="/" className="text-foreground underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
