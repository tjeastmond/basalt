"use client";

import { Fragment, useMemo, useState } from "react";

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
  const updateUser = trpc.users.updateUser.useMutation({
    onSuccess: async () => {
      await utils.users.list.invalidate();
      setEditingUserId(null);
      setEditName("");
      setEditPassword("");
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState<AccessSlug>("user");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");

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
          <table className="w-full min-w-lg text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Access</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <Fragment key={u.id}>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2">{u.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2">
                      <LevelSelect
                        userId={u.id}
                        value={u.accessSlug as AccessSlug}
                        disabled={updateLevel.isPending || updateUser.isPending}
                        actorSlug={props.actorSlug}
                        onChange={(slug) => {
                          void updateLevel.mutateAsync({ userId: u.id, accessLevelSlug: slug });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {editingUserId === u.id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => {
                            setEditingUserId(null);
                            setEditName("");
                            setEditPassword("");
                          }}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={updateUser.isPending}
                          onClick={() => {
                            setEditingUserId(u.id);
                            setEditName(u.name);
                            setEditPassword("");
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                  {editingUserId === u.id ? (
                    <tr className="border-b border-border bg-muted/20 last:border-0">
                      <td colSpan={4} className="px-3 py-4">
                        <form
                          className="flex max-w-lg flex-col gap-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const trimmedPw = editPassword.trim();
                            if (trimmedPw.length > 0 && trimmedPw.length < 8) {
                              return;
                            }
                            void updateUser.mutateAsync({
                              userId: u.id,
                              name: editName.trim(),
                              ...(trimmedPw.length >= 8 ? { password: trimmedPw } : {}),
                            });
                          }}
                        >
                          <p className="text-muted-foreground text-xs">
                            Update name and optionally set a new password (min 8 characters).
                          </p>
                          <label className="flex flex-col gap-1 text-sm">
                            <span>Name</span>
                            <input
                              required
                              value={editName}
                              onChange={(ev) => setEditName(ev.target.value)}
                              className="border-input rounded-md border px-3 py-2 text-sm"
                              maxLength={200}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span>New password</span>
                            <input
                              type="password"
                              minLength={8}
                              value={editPassword}
                              onChange={(ev) => setEditPassword(ev.target.value)}
                              placeholder="Leave blank to keep current"
                              className="border-input rounded-md border px-3 py-2 text-sm"
                            />
                          </label>
                          {editPassword.trim().length > 0 && editPassword.trim().length < 8 ? (
                            <p className="text-destructive text-xs">Password must be at least 8 characters.</p>
                          ) : null}
                          {updateUser.error ? (
                            <p className="text-destructive text-sm">{updateUser.error.message}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" size="sm" disabled={updateUser.isPending}>
                              {updateUser.isPending ? "Saving…" : "Save changes"}
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
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
      className="border-input max-w-40 rounded-md border px-2 py-1 text-sm"
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
