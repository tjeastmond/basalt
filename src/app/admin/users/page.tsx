import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UsersAdmin } from "@/app/admin/users/users-admin";
import { getMemberFromHeaders, isAdminOrOwner } from "@/lib/member";

export default async function AdminUsersPage() {
  const member = await getMemberFromHeaders(await headers());
  if (!member) {
    redirect("/login");
  }
  if (!isAdminOrOwner(member)) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Owner and Admin can create accounts and assign roles (Owner-only for the Owner role).
        </p>
      </div>
      <UsersAdmin actorSlug={member.accessSlug} />
    </main>
  );
}
