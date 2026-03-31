"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

type MeData = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  accessSlug: string;
  onboardingCompletedAt: Date | null;
};

function ProfileFormLoaded(props: { data: MeData }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [name, setName] = useState(props.data.name);
  const [image, setImage] = useState(props.data.image ?? "");
  const update = trpc.me.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.me.get.invalidate();
      router.refresh();
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedImage = image.trim();
    await update.mutateAsync({
      name: name.trim(),
      image: trimmedImage === "" ? null : trimmedImage,
    });
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Name</span>
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          required
          maxLength={200}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Avatar URL</span>
        <input
          value={image}
          onChange={(ev) => setImage(ev.target.value)}
          type="url"
          placeholder="https://…"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          maxLength={2000}
        />
        <span className="text-muted-foreground text-xs">Leave empty to clear.</span>
      </label>
      <div className="text-muted-foreground text-xs">
        Role: <span className="font-medium text-foreground">{props.data.accessSlug}</span>
      </div>
      {update.error ? <p className="text-destructive text-sm">{update.error.message}</p> : null}
      {update.isSuccess ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function ProfileForm() {
  const { data, isPending, error: loadError } = trpc.me.get.useQuery();

  if (isPending && !data) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>;
  }

  if (loadError || !data) {
    return <p className="text-sm text-destructive">Could not load profile.</p>;
  }

  return <ProfileFormLoaded key={`${data.name}:${data.image ?? ""}`} data={data} />;
}
