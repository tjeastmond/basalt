import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/app/settings/profile/profile-form";
import { getMemberFromHeaders } from "@/lib/member";

export default async function ProfilePage() {
  const member = await getMemberFromHeaders(await headers());
  if (!member) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Update your profile, avatar, and password.</p>
      </div>
      <ProfileForm />
    </main>
  );
}
