"use client";

import { useRef, useState, type JSX } from "react";
import { Camera, ImageIcon } from "lucide-react";
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
import { compressPhoto } from "@/lib/progress-photos/compress";
import {
  deleteProgressPhoto,
  uploadProgressPhoto,
} from "@/lib/progress-photos/mutations";
import type { ProgressPhoto } from "@/lib/progress-photos/queries";
import {
  groupPhotosByMonth,
  photoDayLabel,
} from "@/lib/progress-photos/timeline";
import { normalizeLogDate } from "@/lib/bodyweight/log-date";
import { createClient } from "@/lib/supabase/client";

/**
 * The progress-photo half of Progress → Trends → Body (D29): capture and
 * timeline in one place, next to the bodyweight chart.
 *
 * Client component by necessity (file input, upload progress, lightbox,
 * delete) but it fetches NOTHING — the server page does the query and the
 * URL signing and hands the rows down, same shape as BodyweightSection.
 */
export function ProgressPhotosSection({
  photos,
  available,
  defaultDate,
}: {
  photos: ProgressPhoto[];
  available: boolean;
  /** Today per the APP clock (profile timezone), authored server-side. */
  defaultDate: string;
}): JSX.Element {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgressPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const groups = groupPhotosByMonth(photos);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first so picking the SAME file twice still fires a change event.
    event.target.value = "";

    if (!file) {
      return;
    }

    setError(null);

    const resolved = normalizeLogDate(date, defaultDate);

    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }

    setUploading(true);

    try {
      // Best-effort downscale — compressPhoto returns the original on any
      // failure, so this can never be the reason a photo doesn't save.
      const prepared = await compressPhoto(file);
      const result = await uploadProgressPhoto(
        createClient(),
        {
          blob: prepared.blob,
          type: prepared.type,
          size: prepared.blob.size,
        },
        resolved.date,
        "",
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDate("");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Upload failed — ${cause.message}`
          : "Upload failed — please retry.",
      );
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const result = await deleteProgressPhoto(
      createClient(),
      deleteTarget.photo_id,
      deleteTarget.storage_path,
    );

    setDeleting(false);

    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }

    setDeleteTarget(null);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-2.5">
      {/* Sub-heading, not a second .eyebrow — see BodyweightSection. The
          "Body" eyebrow on the page heads both halves. */}
      <h3 className="text-sm font-medium text-foreground">Photos</h3>

      {!available ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          Progress photos need database migration 027 applied
          (supabase/migrations/027_progress_photos.sql), including the private
          progress-photos Storage bucket it creates.
        </div>
      ) : (
        <>
          {groups.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
              No progress photos yet. Take one and your timeline starts here —
              the scale and the mirror disagree often enough to be worth both.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.key} className="flex flex-col gap-2">
                  <p className="eyebrow">{group.label}</p>
                  <ul className="grid grid-cols-3 gap-2">
                    {group.photos.map((photo) => (
                      <li key={photo.photo_id}>
                        <button
                          type="button"
                          onClick={() => setViewing(photo)}
                          aria-label={`Open progress photo from ${photoDayLabel(photo.taken_on)}`}
                          className="flex w-full flex-col gap-1 text-left"
                        >
                          <span className="block aspect-square w-full overflow-hidden rounded-[var(--radius)] border border-border bg-card-alt">
                            {photo.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photo.url}
                                alt={`Progress photo from ${photoDayLabel(photo.taken_on)}`}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.1em] text-faint">
                                Unavailable
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                            {photoDayLabel(photo.taken_on)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Two inputs so the primary control is camera-first while an
              existing photo stays reachable — `capture="environment"` opens
              the rear camera on iOS/Android; the library input omits it, so
              the OS shows the photo picker. Same split as LogMealSheet. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            aria-label="Take a progress photo"
            className="hidden"
            onChange={handleFile}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose an existing progress photo"
            className="hidden"
            onChange={handleFile}
          />

          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-opacity disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                {uploading ? "Uploading…" : "Add photo"}
              </button>
              <input
                type="date"
                value={date}
                max={defaultDate}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Date this photo was taken"
                className="h-11 w-[9.5rem] shrink-0 rounded-[var(--radius)] border border-border bg-card-alt px-3 font-mono text-sm tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => libraryInputRef.current?.click()}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-subtle disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              Choose an existing photo
            </button>
            <p className="px-1 text-[11px] leading-relaxed text-faint">
              Private to your account. Blank date = today ({defaultDate}).
            </p>
          </div>

          {error ? (
            <p className="text-sm leading-5 text-danger">{error}</p>
          ) : null}
        </>
      )}

      {/* Lightbox. Separate from the confirm dialog (never both open) — the
          same pattern MealsSection uses for edit-then-delete. */}
      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => (!open ? setViewing(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {viewing ? photoDayLabel(viewing.taken_on) : ""}
            </DialogTitle>
            <DialogDescription>
              {viewing?.note ? viewing.note : "Progress photo"}
            </DialogDescription>
          </DialogHeader>

          {viewing?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewing.url}
              alt={`Progress photo from ${photoDayLabel(viewing.taken_on)}`}
              className="max-h-[60vh] w-full rounded-[var(--radius)] border border-border bg-card-alt object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This photo couldn&apos;t be loaded. Reload the page to re-sign its
              link.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger sm:mr-auto"
              onClick={() => {
                const target = viewing;
                setViewing(null);
                setDeleteTarget(target);
              }}
            >
              Delete
            </Button>
            {/* "Done", not "Close": DialogContent already renders an sr-only
                "Close" for its ✕, and two buttons with the same accessible
                name inside one dialog is an a11y smell (and an ambiguous
                locator for the drive). */}
            <Button type="button" onClick={() => setViewing(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete photo?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This permanently removes the photo from ${photoDayLabel(deleteTarget.taken_on)}. It can't be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-danger">{deleteError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
