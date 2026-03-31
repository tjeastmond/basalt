"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  humanizeFieldMachineName,
  type CollectionFieldDefinition,
  type CollectionFieldType,
} from "@/lib/collection-fields";
import { trpc } from "@/trpc/react";

function valueToInput(field: CollectionFieldDefinition, raw: unknown): string {
  if (raw === null || raw === undefined) {
    return "";
  }
  if (field.type === "boolean") {
    return raw === true ? "true" : "false";
  }
  if (field.type === "json" && typeof raw === "object") {
    return JSON.stringify(raw, null, 2);
  }
  if (raw instanceof Date) {
    return raw.toISOString();
  }
  return String(raw);
}

function parseFieldInput(
  field: CollectionFieldDefinition,
  raw: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: undefined };
  }
  switch (field.type) {
    case "text":
      return { ok: true, value: raw };
    case "number": {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        return { ok: false, message: `"${field.name}" must be a finite number.` };
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
      return { ok: false, message: `"${field.name}": choose true or false.` };
    }
    case "date": {
      const t = Date.parse(trimmed);
      if (Number.isNaN(t)) {
        return { ok: false, message: `"${field.name}" must be a parseable date (ISO-8601).` };
      }
      return { ok: true, value: new Date(t).toISOString() };
    }
    case "json": {
      try {
        return { ok: true, value: JSON.parse(trimmed) as unknown };
      } catch {
        return { ok: false, message: `"${field.name}" must be valid JSON.` };
      }
    }
    default: {
      const _e: never = field.type;
      return { ok: false, message: `Unknown type ${_e}.` };
    }
  }
}

type Props = {
  collectionId: string;
  fields: CollectionFieldDefinition[];
  mode: "create" | "edit";
  recordId?: string;
  initialValues?: Record<string, unknown>;
};

export function RecordForm(props: Props) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const initialInputs = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of props.fields) {
      const raw = props.initialValues?.[f.name];
      m[f.name] = valueToInput(f, raw);
    }
    return m;
  }, [props.fields, props.initialValues]);

  const [inputs, setInputs] = useState<Record<string, string>>(initialInputs);
  const [formError, setFormError] = useState<string | null>(null);

  const createMut = trpc.records.create.useMutation({
    onSuccess: async () => {
      await utils.records.list.invalidate();
      router.push(`/collections/${props.collectionId}/records`);
      router.refresh();
    },
    onError: (e) => setFormError(e.message),
  });

  const updateMut = trpc.records.update.useMutation({
    onSuccess: async () => {
      await utils.records.list.invalidate();
      await utils.records.byId.invalidate();
      router.push(`/collections/${props.collectionId}/records`);
      router.refresh();
    },
    onError: (e) => setFormError(e.message),
  });

  const deleteMut = trpc.records.delete.useMutation({
    onSuccess: async () => {
      await utils.records.list.invalidate();
      router.push(`/collections/${props.collectionId}/records`);
      router.refresh();
    },
    onError: (e) => setFormError(e.message),
  });

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  function setField(name: string, value: string) {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }

  function buildValues(requireAllDefined: boolean): Record<string, unknown> | null {
    const out: Record<string, unknown> = {};
    for (const f of props.fields) {
      const raw = inputs[f.name] ?? "";
      const parsed = parseFieldInput(f, raw);
      if (!parsed.ok) {
        setFormError(parsed.message);
        return null;
      }
      if (parsed.value === undefined) {
        if (requireAllDefined && f.required && f.defaultValue === undefined) {
          setFormError(`"${f.name}" is required.`);
          return null;
        }
        if (props.mode === "edit" && raw.trim() === "") {
          continue;
        }
        if (props.mode === "create") {
          continue;
        }
      }
      if (parsed.value !== undefined) {
        out[f.name] = parsed.value;
      }
    }
    setFormError(null);
    return out;
  }

  async function submit() {
    setFormError(null);
    if (props.mode === "create") {
      const values = buildValues(true);
      if (!values) {
        return;
      }
      await createMut.mutateAsync({ collectionId: props.collectionId, values });
      return;
    }
    const values = buildValues(false);
    if (!values) {
      return;
    }
    if (!props.recordId) {
      return;
    }
    await updateMut.mutateAsync({ collectionId: props.collectionId, id: props.recordId, values });
  }

  const backHref = `/collections/${props.collectionId}/records`;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="grid max-w-xl gap-4">
        {props.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">This collection has no custom fields. Saving creates a row with only an id.</p>
        ) : null}
        {props.fields.map((f) => (
          <FieldInput key={f.id} field={f} value={inputs[f.name] ?? ""} onChange={(v) => setField(f.name, v)} disabled={busy} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {props.mode === "create" ? "Create record" : "Save changes"}
        </Button>
        <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
          Cancel
        </Link>
        {props.mode === "edit" && props.recordId ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Delete this record? This cannot be undone.")) {
                return;
              }
              void deleteMut.mutateAsync({ collectionId: props.collectionId, id: props.recordId! });
            }}
          >
            Delete record
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FieldInput(props: {
  field: CollectionFieldDefinition;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const { field: f } = props;
  const hint = (t: CollectionFieldType) => {
    switch (t) {
      case "text":
        return "Plain text.";
      case "number":
        return "Finite number.";
      case "boolean":
        return "Choose true or false.";
      case "date":
        return "ISO-8601 date/time.";
      case "json":
        return "Valid JSON object or array.";
      default: {
        const _x: never = t;
        return _x;
      }
    }
  };

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {humanizeFieldMachineName(f.name)}
        {f.required ? <span className="text-destructive"> *</span> : null}
        <span className="text-muted-foreground font-normal"> ({f.type})</span>
      </span>
      {f.type === "boolean" ? (
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="border-input rounded-md border px-3 py-2 text-sm"
          disabled={props.disabled}
        >
          <option value="">—</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : f.type === "json" ? (
        <textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="border-input min-h-24 rounded-md border px-3 py-2 font-mono text-sm"
          disabled={props.disabled}
        />
      ) : (
        <input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="border-input rounded-md border px-3 py-2 text-sm"
          disabled={props.disabled}
          autoComplete="off"
        />
      )}
      <span className="text-muted-foreground text-xs">{hint(f.type)}</span>
    </label>
  );
}
