"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CollectionFieldDefinition, CollectionFieldType } from "@/lib/collection-fields";
import { trpc } from "@/trpc/react";

const fieldTypes: CollectionFieldType[] = ["text", "number", "boolean", "date", "json"];

function nextFieldName(index: number): string {
  return `field_${index + 1}`;
}

function defaultValueToInput(field: CollectionFieldDefinition): string {
  if (field.defaultValue === undefined) {
    return "";
  }
  if (field.type === "json" && field.defaultValue !== null && typeof field.defaultValue === "object") {
    return JSON.stringify(field.defaultValue, null, 2);
  }
  if (field.type === "boolean") {
    return field.defaultValue === true ? "true" : "false";
  }
  return String(field.defaultValue);
}

function parseDefaultValue(
  type: CollectionFieldType,
  raw: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: undefined };
  }
  switch (type) {
    case "text":
      return { ok: true, value: raw };
    case "number": {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        return { ok: false, message: "Default must be a finite number." };
      }
      return { ok: true, value: n };
    }
    case "boolean": {
      if (trimmed === "true") {
        return { ok: true, value: true };
      }
      if (trimmed === "false") {
        return { ok: true, value: false };
      }
      return { ok: false, message: 'Use "true" or "false" for boolean default.' };
    }
    case "date": {
      const t = Date.parse(trimmed);
      if (Number.isNaN(t)) {
        return { ok: false, message: "Default must be a parseable date (e.g. ISO-8601)." };
      }
      return { ok: true, value: new Date(t).toISOString() };
    }
    case "json": {
      try {
        return { ok: true, value: JSON.parse(trimmed) as unknown };
      } catch {
        return { ok: false, message: "Default must be valid JSON." };
      }
    }
    default:
      return { ok: false, message: "Unknown type." };
  }
}

export type CollectionEditorInitial = {
  id: string;
  slug: string;
  name: string;
  fields: CollectionFieldDefinition[];
  updatedAt: string;
};

type CollectionEditorProps =
  | { mode: "create"; onCancelHref: string }
  | { mode: "edit"; collectionId: string; initial: CollectionEditorInitial; onCancelHref: string };

export function CollectionEditor(props: CollectionEditorProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [slug, setSlug] = useState(() => (props.mode === "edit" ? props.initial.slug : ""));
  const [name, setName] = useState(() => (props.mode === "edit" ? props.initial.name : ""));
  const [fields, setFields] = useState<CollectionFieldDefinition[]>(() =>
    props.mode === "edit" ? props.initial.fields : [],
  );
  const [defaultInputs, setDefaultInputs] = useState<Record<string, string>>(() =>
    props.mode === "edit" ? Object.fromEntries(props.initial.fields.map((f) => [f.id, defaultValueToInput(f)])) : {},
  );

  const [formError, setFormError] = useState<string | null>(null);

  const createMut = trpc.collections.create.useMutation({
    onSuccess: async () => {
      await utils.collections.list.invalidate();
      router.push("/collections");
      router.refresh();
    },
    onError: (e) => setFormError(e.message),
  });

  const updateMut = trpc.collections.update.useMutation({
    onError: (e) => setFormError(e.message),
  });

  const deleteMut = trpc.collections.delete.useMutation({
    onSuccess: async () => {
      await utils.collections.list.invalidate();
      router.push("/collections");
      router.refresh();
    },
    onError: (e) => setFormError(e.message),
  });

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const usedNames = useMemo(() => new Set(fields.map((f) => f.name)), [fields]);

  function setDefaultInput(fieldId: string, value: string) {
    setDefaultInputs((prev) => ({ ...prev, [fieldId]: value }));
  }

  function addField() {
    let n = fields.length;
    let candidate = nextFieldName(n);
    while (usedNames.has(candidate)) {
      n += 1;
      candidate = nextFieldName(n);
    }
    const id = crypto.randomUUID();
    setFields((prev) => [
      ...prev,
      {
        id,
        name: candidate,
        type: "text",
        required: false,
        unique: false,
      },
    ]);
    setDefaultInputs((prev) => ({ ...prev, [id]: "" }));
  }

  function updateField(id: string, patch: Partial<CollectionFieldDefinition>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setDefaultInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function submit() {
    setFormError(null);
    const trimmedSlug = slug.trim();
    const trimmedName = name.trim();
    if (!trimmedSlug || !trimmedName) {
      setFormError("Slug and name are required.");
      return;
    }

    const built: CollectionFieldDefinition[] = [];
    for (const f of fields) {
      const rawDefault = defaultInputs[f.id] ?? "";
      const parsed = parseDefaultValue(f.type, f.type === "boolean" ? rawDefault.trim() || "" : rawDefault);
      if (!parsed.ok) {
        setFormError(`Field "${f.name}": ${parsed.message}`);
        return;
      }
      const def: CollectionFieldDefinition = {
        id: f.id,
        name: f.name.trim(),
        type: f.type,
        required: f.required,
        unique: f.unique,
      };
      if (parsed.value !== undefined) {
        def.defaultValue = parsed.value;
      }
      built.push(def);
    }

    if (props.mode === "create") {
      await createMut.mutateAsync({ slug: trimmedSlug, name: trimmedName, fields: built });
      return;
    }

    const first = await updateMut.mutateAsync({
      id: props.collectionId,
      slug: trimmedSlug,
      name: trimmedName,
      fields: built,
    });

    if (first.status === "needsConfirmation") {
      const parts: string[] = [];
      if (first.removedFieldIds.length > 0) {
        parts.push(`Remove fields (ids): ${first.removedFieldIds.join(", ")}`);
      }
      if (first.unsafeTypeFieldIds.length > 0) {
        parts.push(`Unsafe type changes (ids): ${first.unsafeTypeFieldIds.join(", ")}`);
      }
      const ok = window.confirm(`${parts.join("\n")}\n\nProceed?`);
      if (!ok) {
        return;
      }
      const second = await updateMut.mutateAsync({
        id: props.collectionId,
        slug: trimmedSlug,
        name: trimmedName,
        fields: built,
        removedFieldIds: first.removedFieldIds,
        confirmedUnsafeTypeFieldIds: first.unsafeTypeFieldIds,
      });
      if (second.status === "needsConfirmation") {
        setFormError("Server still requires confirmation; refresh and try again.");
        return;
      }
      await utils.collections.list.invalidate();
      router.refresh();
      return;
    }

    await utils.collections.list.invalidate();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="grid max-w-xl gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border-input rounded-md border px-3 py-2 text-sm"
            placeholder="posts"
            disabled={busy}
            autoComplete="off"
          />
          <span className="text-muted-foreground text-xs">Lowercase identifier used in URLs and APIs.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-input rounded-md border px-3 py-2 text-sm"
            placeholder="Posts"
            disabled={busy}
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Fields</h2>
          <Button type="button" variant="outline" size="sm" onClick={addField} disabled={busy}>
            Add field
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">No fields yet. Add fields or save an empty schema.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {fields.map((f) => (
              <li key={f.id} className="rounded-md border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Field name</span>
                    <input
                      value={f.name}
                      onChange={(e) => updateField(f.id, { name: e.target.value })}
                      className="border-input rounded-md border px-3 py-2 text-sm"
                      disabled={busy}
                    />
                    <span className="text-muted-foreground text-xs">
                      Stored as a lowercase identifier; spaces and punctuation become underscores (e.g. Post Title →
                      post_title).
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Type</span>
                    <select
                      value={f.type}
                      onChange={(e) => updateField(f.id, { type: e.target.value as CollectionFieldType })}
                      className="border-input rounded-md border px-3 py-2 text-sm"
                      disabled={busy}
                    >
                      {fieldTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => updateField(f.id, { required: e.target.checked })}
                      disabled={busy}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.unique}
                      onChange={(e) => updateField(f.id, { unique: e.target.checked })}
                      disabled={busy}
                    />
                    Unique
                  </label>
                  <label className="col-span-full flex flex-col gap-1 text-sm">
                    <span>Default (optional)</span>
                    {f.type === "boolean" ? (
                      <select
                        value={defaultInputs[f.id] ?? ""}
                        onChange={(e) => setDefaultInput(f.id, e.target.value)}
                        className="border-input rounded-md border px-3 py-2 text-sm"
                        disabled={busy}
                      >
                        <option value="">No default</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <textarea
                        value={defaultInputs[f.id] ?? ""}
                        onChange={(e) => setDefaultInput(f.id, e.target.value)}
                        className="border-input min-h-[4rem] rounded-md border px-3 py-2 font-mono text-sm"
                        placeholder={f.type === "json" ? '{"key": "value"}' : undefined}
                        disabled={busy}
                      />
                    )}
                    <span className="text-muted-foreground text-xs">
                      {f.type === "boolean"
                        ? "Choose a default boolean."
                        : f.type === "json"
                          ? "Valid JSON object or array."
                          : f.type === "number"
                            ? "Numeric default."
                            : f.type === "date"
                              ? "ISO-8601 date string."
                              : "Plain text default."}
                    </span>
                  </label>
                </div>
                <div className="mt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeField(f.id)} disabled={busy}>
                    Remove field
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void submit()} disabled={busy}>
          {props.mode === "create" ? "Create collection" : "Save changes"}
        </Button>
        <Link href={props.onCancelHref} className={cn(buttonVariants({ variant: "outline" }))}>
          Cancel
        </Link>
        {props.mode === "edit" ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Delete this collection? This cannot be undone.")) {
                return;
              }
              void deleteMut.mutateAsync({ id: props.collectionId });
            }}
          >
            Delete collection
          </Button>
        ) : null}
      </div>
    </div>
  );
}
