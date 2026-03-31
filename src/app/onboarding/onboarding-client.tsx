"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react";

export function OnboardingClient() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const complete = trpc.me.completeOnboarding.useMutation({
    onSuccess: async () => {
      await utils.me.get.invalidate();
      router.push("/");
      router.refresh();
    },
  });
  const [error, setError] = useState<string | null>(null);

  async function skipForNow() {
    setError(null);
    try {
      await complete.mutateAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Welcome to Basalt</h1>
        <p className="text-sm text-muted-foreground">
          Start by creating your first collection. Collections define the shape of your data and power the admin UI and
          API.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/collections/new" className={cn(buttonVariants({ variant: "default" }), "inline-flex text-center")}>
          Create your first collection
        </Link>
        <Button type="button" variant="outline" disabled={complete.isPending} onClick={() => void skipForNow()}>
          {complete.isPending ? "Saving…" : "Skip for now"}
        </Button>
      </div>
      {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
    </main>
  );
}
