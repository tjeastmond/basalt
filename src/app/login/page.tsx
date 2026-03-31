"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/",
      });
      if (signInError) {
        setError(signInError.message ?? "Sign in failed");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Local email and password</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-left text-sm">
          <span className="font-medium text-foreground">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-left text-sm">
          <span className="font-medium text-foreground">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            required
          />
        </label>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="text-foreground underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
