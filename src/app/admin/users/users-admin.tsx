"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

type AccessSlug = "owner" | "admin" | "user";

export function UsersAdmin(props: { actorSlug: AccessSlug }) {
  const utils = trpc.useUtils();
  const { data, isPending, error } = trpc.users.list.useQuery();
  const createUser = trpc.users.create.useMutation({
    onSuccess: async () => {
      await utils.users.list.invalidate();
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewLevel("user");
    },
  });
  const updateLevel = trpc.users.updateAccessLevel.useMutation({
    onSuccess: async () => {
      await utils.users.list.invalidate();
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState<AccessSlug>("user");

  const canPickOwnerOnCreate = props.actorSlug === "owner";

  const levelOptions = useMemo(() => {
    const base: AccessSlug[] = ["user", "admin"];
    if (canPickOwnerOnCreate) {
      base.push("owner");
    }
    return base;
  }, [canPickOwnerOnCreate]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Invite teammates by email and set their access level.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen((o) => !o)}>
          {createOpen ? "Close" : "New user"}
        </Button>
      </div>

      {createOpen ? (
        <form
          className="flex max-w-md flex-col gap-3 rounded-md border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void createUser.mutateAsync({
              email: newEmail.trim(),
              password: newPassword,
              name: newName.trim(),
              accessLevelSlug: newLevel,
            });
          }}
        >
          <h2 className="text-sm font-medium">Create user</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span>Name</span>
            <input
              required
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              className="border-input rounded-md border px-3 py-2 text-sm"
              maxLength={200}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Email</span>
            <input
              required
              type="email"
              value={newEmail}
              onChange={(ev) => setNewEmail(ev.target.value)}
              className="border-input rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Temporary password</span>
            <input
              required
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
              className="border-input rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Access level</span>
            <select
              value={newLevel}
              onChange={(ev) => setNewLevel(ev.target.value as AccessSlug)}
              className="border-input rounded-md border px-3 py-2 text-sm"
            >
              {levelOptions.map((slug) => (
                <option key={slug} value={slug}>
                  {slug}
                </option>
              ))}
            </select>
          </label>
          {createUser.error ? <p className="text-destructive text-sm">{createUser.error.message}</p> : null}
          <Button type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? "Creating…" : "Create user"}
          </Button>
        </form>
      ) : null}

      {isPending ? <p className="text-sm text-muted-foreground">Loading users…</p> : null}
      {error ? <p className="text-destructive text-sm">{error.message}</p> : null}

      {data ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Access</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2">
                    <LevelSelect
                      userId={u.id}
                      value={u.accessSlug as AccessSlug}
                      disabled={updateLevel.isPending}
                      actorSlug={props.actorSlug}
                      onChange={(slug) => {
                        void updateLevel.mutateAsync({ userId: u.id, accessLevelSlug: slug });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {updateLevel.error ? <p className="text-destructive text-sm">{updateLevel.error.message}</p> : null}
    </div>
  );
}

function LevelSelect(props: {
  userId: string;
  value: AccessSlug;
  actorSlug: AccessSlug;
  disabled: boolean;
  onChange: (slug: AccessSlug) => void;
}) {
  if (props.actorSlug !== "owner" && props.value === "owner") {
    return <span className="text-muted-foreground text-sm">owner</span>;
  }

  const options: AccessSlug[] = props.actorSlug === "owner" ? ["owner", "admin", "user"] : ["admin", "user"];

  return (
    <select
      className="border-input max-w-[10rem] rounded-md border px-2 py-1 text-sm"
      value={props.value}
      disabled={props.disabled}
      onChange={(ev) => props.onChange(ev.target.value as AccessSlug)}
      aria-label={`Access level for user ${props.userId}`}
    >
      {options.map((slug) => (
        <option key={slug} value={slug}>
          {slug}
        </option>
      ))}
    </select>
  );
}
