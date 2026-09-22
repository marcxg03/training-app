import { createClient } from "@/lib/supabase/client";
import { loadQueue } from "@/lib/sync/queue";

type SignOutResult = {
  aborted: boolean;
};

function getQueuedSignOutMessage(queueLength: number) {
  return `You have ${queueLength} unsynced ${
    queueLength === 1 ? "set" : "sets"
  }. They'll be saved next time you sign in to this account on this device.`;
}

async function showQueuedSignOutDialog(queueLength: number) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const message = getQueuedSignOutMessage(queueLength);

  if (typeof HTMLDialogElement === "undefined") {
    return window.confirm(message);
  }

  return new Promise<boolean>((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className =
      "rounded-lg border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/80";

    const panel = document.createElement("div");
    panel.className = "w-[min(28rem,calc(100vw-2rem))] space-y-4 p-6";

    const title = document.createElement("h2");
    title.className = "text-lg font-semibold tracking-tight";
    title.textContent = "Sign out?";

    const body = document.createElement("p");
    body.className = "text-sm text-muted-foreground";
    body.textContent = message;

    const footer = document.createElement("div");
    footer.className =
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className =
      "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted";
    cancelButton.textContent = "Cancel";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className =
      "inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90";
    confirmButton.textContent = "Sign out anyway";

    footer.append(cancelButton, confirmButton);
    panel.append(title, body, footer);
    dialog.append(panel);

    const cleanup = () => {
      cancelButton.removeEventListener("click", handleCancel);
      confirmButton.removeEventListener("click", handleConfirm);
      dialog.removeEventListener("cancel", handleCancelEvent);
      dialog.removeEventListener("close", handleClose);
      dialog.remove();
    };

    const handleCancel = () => {
      dialog.close("cancel");
    };

    const handleConfirm = () => {
      dialog.close("confirm");
    };

    const handleCancelEvent = (event: Event) => {
      event.preventDefault();
      dialog.close("cancel");
    };

    const handleClose = () => {
      const confirmed = dialog.returnValue === "confirm";
      cleanup();
      resolve(confirmed);
    };

    cancelButton.addEventListener("click", handleCancel);
    confirmButton.addEventListener("click", handleConfirm);
    dialog.addEventListener("cancel", handleCancelEvent);
    dialog.addEventListener("close", handleClose);

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

export async function signOut(userId: string): Promise<SignOutResult> {
  const queue = loadQueue(userId);

  if (queue.length > 0) {
    const confirmed = await showQueuedSignOutDialog(queue.length);

    if (!confirmed) {
      return { aborted: true };
    }
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  return { aborted: false };
}
