"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  activatePlan,
  createPlan,
  deletePlan,
  renamePlan,
} from "@/lib/plan/plan-mutations";
import { createClient } from "@/lib/supabase/client";

type PlanOption = { plan_id: string; name: string };

type PlanControlsProps = {
  plans: PlanOption[];
  activePlanId: string | null;
  userId: string;
};

type DialogMode = "create" | "rename" | null;

const MAX_NAME = 60;

export function PlanControls({
  plans,
  activePlanId,
  userId,
}: PlanControlsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState("");

  const activeName =
    plans.find((plan) => plan.plan_id === activePlanId)?.name ?? "";

  const handleActivate = async (planId: string) => {
    if (planId === activePlanId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await activatePlan(createClient(), userId, planId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
    }
    // Refresh either way so the Select reflects the true server-side active plan.
    router.refresh();
  };

  const openCreate = () => {
    setName("");
    setError(null);
    setDialogMode("create");
  };

  const openRename = () => {
    setName(activeName);
    setError(null);
    setDialogMode("rename");
  };

  const trimmed = name.trim();
  const nameValid = trimmed.length > 0 && trimmed.length <= MAX_NAME;

  const handleSubmit = async () => {
    if (!nameValid || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const result =
      dialogMode === "create"
        ? await createPlan(supabase, userId, trimmed)
        : activePlanId
          ? await renamePlan(supabase, activePlanId, trimmed)
          : { ok: false as const, error: "No active plan to rename." };
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDialogMode(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!activePlanId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deletePlan(createClient(), userId, activePlanId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeleteOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
        Plan Tab
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={activePlanId ?? undefined}
          onValueChange={handleActivate}
        >
          <SelectTrigger className="h-12 min-w-[12rem] flex-1 text-lg font-semibold">
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((plan) => (
              <SelectItem key={plan.plan_id} value={plan.plan_id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={openRename}
          disabled={activePlanId === null}
        >
          Rename
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            setDeleteOpen(true);
          }}
          disabled={activePlanId === null}
        >
          Delete
        </Button>
        <Button type="button" onClick={openCreate}>
          New plan
        </Button>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        The active plan drives Today, the week below, and your nutrition
        day-type. Switch plans here; build a new one in the day editor.
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "New plan" : "Rename plan"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Creates an empty 7-day plan. Select it above to make it active, then build it in the day editor."
                : "Rename the active plan."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input
              id="plan-name"
              value={name}
              maxLength={MAX_NAME}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogMode(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!nameValid || busy}
            >
              {dialogMode === "create" ? "Create plan" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{activeName}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the plan and everything scheduled in it,
              including any logged history. If it&rsquo;s your active plan,
              another plan becomes active.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
