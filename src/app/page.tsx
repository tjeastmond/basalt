import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getMemberFromHeaders } from "@/lib/member";

export default async function Home() {
  const member = await getMemberFromHeaders(await headers());
  if (member && !member.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Basalt</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Local auth is wired (Better Auth + Postgres). After <code className="text-foreground">pnpm db:migrate</code> and{" "}
        <code className="text-foreground">pnpm db:seed</code>, sign in on the{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          login page
        </Link>
        . Next: collections and records.
      </p>
    </main>
  );
}
