import Link from "next/link";

import { HeaderAuthNav } from "@/components/header-auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getServerSession } from "@/lib/session";

export async function AppHeader() {
  const session = await getServerSession();
  const initialSignedIn = Boolean(session?.user);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Basalt
      </Link>
      <div className="flex items-center gap-3">
        <HeaderAuthNav initialSignedIn={initialSignedIn} />
        <ThemeToggle />
      </div>
    </header>
  );
}
