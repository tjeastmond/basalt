"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

const linkClass = "text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline";

type HeaderAuthNavProps = {
  /** From server session on first paint — avoids “Sign in” flash when cookies already hold a session */
  initialSignedIn: boolean;
};

/** Outer shell: remounts inner nav when the route changes so logout / login state resets cleanly */
export function HeaderAuthNav(props: HeaderAuthNavProps) {
  const pathname = usePathname();
  return <HeaderAuthNavInner key={pathname} pathname={pathname} {...props} />;
}

function HeaderAuthNavInner({ pathname, initialSignedIn }: HeaderAuthNavProps & { pathname: string }) {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLoginRoute = pathname === "/login";
  const allowServerHint = !onLoginRoute && !loggingOut;
  const loggedIn = Boolean(data?.user) || (allowServerHint && isPending && initialSignedIn && data == null);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="inline-flex min-w-[5.25rem] justify-end">
      {loggedIn ? (
        <button type="button" onClick={handleLogout} className={linkClass}>
          Log out
        </button>
      ) : (
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
      )}
    </div>
  );
}
