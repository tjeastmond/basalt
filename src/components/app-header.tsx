import Link from "next/link";
import { headers } from "next/headers";

import { HeaderAuthNav } from "@/components/header-auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMemberFromHeaders } from "@/lib/member";

export async function AppHeader() {
  const member = await getMemberFromHeaders(await headers());
  const initialSignedIn = Boolean(member);
  const initialAccessSlug = member?.accessSlug ?? null;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Basalt
      </Link>
      <div className="flex items-center gap-3">
        <HeaderAuthNav initialSignedIn={initialSignedIn} initialAccessSlug={initialAccessSlug} />
        <ThemeToggle />
      </div>
    </header>
  );
}
