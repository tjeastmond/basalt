"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/trpc/react";
import { toast } from "sonner";

type MeData = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  accessSlug: string;
  onboardingCompletedAt: Date | null;
};

function ProfileFormLoaded(props: { data: MeData }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(props.data.name);
  const [image, setImage] = useState(props.data.image ?? "");

  const update = trpc.me.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Profile saved.");
      await utils.me.get.invalidate();
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
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setPending(true);
    try {
      const { error: changeError } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      if (changeError) {
        setError(changeError.message ?? "Could not change password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex max-w-md flex-col gap-4 border-t border-border pt-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight">Change password</h2>
        <p className="text-muted-foreground text-xs">Use your current password to set a new one.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Current password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(ev) => setCurrentPassword(ev.target.value)}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          required
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(ev) => setNewPassword(ev.target.value)}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          required
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Confirm new password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(ev) => setConfirmPassword(ev.target.value)}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          required
        />
      </label>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {success ? <p className="text-sm text-muted-foreground">Password updated.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
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

  return (
    <div className="flex flex-col gap-8">
      <ProfileFormLoaded key={data.id} data={data} />
      <ChangePasswordForm />
    </div>
  );
}
