"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  activatePlan,
  createPlan,
  deletePlan,
  duplicatePlan,
  renamePlan,
} from "@/lib/plan/plan-mutations";
import type { ProgramListItem } from "@/lib/plan/queries";

/**
 * Program CRUD for the admin hub (T3-C · D48).
 *
 * Every mutation here ALREADY EXISTED in plan-mutations.ts — `createPlan`,
 * `activatePlan`, `renamePlan`, `deletePlan` have been there since the plan
 * slices; only `duplicatePlan` is new. What was missing was a surface that
 * called them, because the Programs page was pointed at `plan_templates` (a
 * seed-written snapshot archive) instead of `training_plans` (the real,
 * editable programs).
 *
 * `router.refresh()` after every success rather than local optimistic state:
 * activation is a WEEK-WIDE change (exactly one plan is active, so activating
 * one silently deactivates another) and deletion can reassign active status to
 * a different plan. Optimistic UI here would have to re-implement those rules
 * on the client and would drift from the mutation the moment either changes.
 */

type Props = {
  userId: string;
  program: ProgramListItem;
  /** How many programs exist — deletion of the last one is refused. */
  totalPrograms: number;
};

function useProgramAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  };

  return { run, pending, error, setError, router };
}

export function ProgramActions({ userId, program, totalPrograms }: Props) {
  const { run, pending, error } = useProgramAction();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(program.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOnlyProgram = totalPrograms <= 1;

  if (renaming) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed || trimmed === program.name) {
            setRenaming(false);
            return;
          }
          run(async () => {
            const result = await renamePlan(
              createClient(),
              program.plan_id,
              trimmed,
            );
            if (result.ok) setRenaming(false);
            return result;
          });
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={`Rename ${program.name}`}
          className="min-h-9 w-48 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setName(program.name);
            setRenaming(false);
          }}
          className="min-h-9 px-2 text-xs text-subtle hover:text-foreground"
        >
          Cancel
        </button>
        {error ? (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!program.is_active ? (
        <button
          type="button"
          disabled={pending}
          aria-label={`Make ${program.name} active`}
          onClick={() =>
            run(() => activatePlan(createClient(), userId, program.plan_id))
          }
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-subtle transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Make active
        </button>
      ) : null}

      <button
        type="button"
        disabled={pending}
        aria-label={`Rename ${program.name}`}
        onClick={() => setRenaming(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-subtle transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-50"
      >
        <Pencil className="h-3.5 w-3.5" />
        Rename
      </button>

      <button
        type="button"
        disabled={pending}
        aria-label={`Duplicate ${program.name}`}
        onClick={() =>
          run(() =>
            duplicatePlan(
              createClient(),
              userId,
              program.plan_id,
              `${program.name} (copy)`,
            ),
          )
        }
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-subtle transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-50"
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicate
      </button>

      {confirmDelete ? (
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            aria-label={`Confirm delete ${program.name}`}
            onClick={() =>
              run(() => deletePlan(createClient(), userId, program.plan_id))
            }
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-danger px-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete for good
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="min-h-9 px-2 text-xs text-subtle hover:text-foreground"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={pending || isOnlyProgram}
          aria-label={`Delete ${program.name}`}
          title={
            isOnlyProgram
              ? "This is your only program — create another before deleting it."
              : undefined
          }
          onClick={() => setConfirmDelete(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-subtle transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      )}

      {error ? (
        <span role="alert" className="w-full text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** "New program" — creates a 7-day rest skeleton and opens it for editing. */
export function CreateProgramButton({ userId }: { userId: string }) {
  const { run, pending, error, router } = useProgramAction();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
      >
        <Plus className="h-4 w-4" />
        New program
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        run(async () => {
          const result = await createPlan(createClient(), userId, trimmed);
          if (result.ok) {
            setNaming(false);
            setName("");
            // Straight into the week editor: a new program is an empty
            // 7-day rest skeleton, so the list view has nothing to show yet.
            router.push(`/admin/programs/${result.data.plan_id}`);
          }
          return result;
        });
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Program name"
        aria-label="New program name"
        className="min-h-11 w-56 rounded-xl border border-border bg-input px-3 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={pending || name.trim().length === 0}
        className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => {
          setNaming(false);
          setName("");
        }}
        className="min-h-11 px-2 text-sm text-subtle hover:text-foreground"
      >
        Cancel
      </button>
      {error ? (
        <span role="alert" className="w-full text-xs text-danger">
          {error}
        </span>
      ) : null}
    </form>
  );
}
