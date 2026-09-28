import type { JSX } from "react";

// The attribution surface for the vendored exercise artwork (T2-F, D35/D36).
//
// THIS IS A LICENCE OBLIGATION, NOT DECORATION. CC BY-SA 4.0 § 3(a)(1) requires
// that anyone who receives the work is given: the creator's name, a link to the
// material, the licence name WITH a link to its text, and an indication of
// whether changes were made. All four are below. Removing or hiding this
// component puts the app out of compliance — if the figures ever go away,
// delete them and this together, not this alone.
//
// "shown recoloured" is the changes-were-made limb: the files ship
// byte-identical, but they are white-on-transparent art displayed through a
// CSS invert so it reads on a warm-white background (see .figure-seq in
// globals.css). Saying so costs a clause and removes the argument.

const CREDITS = [
  {
    what: "Exercise figures",
    creator: "Bryl Lim",
    creatorUrl: "https://bryllim.com",
    source: "Workout Guide",
    sourceUrl: "https://bryllim.github.io/workout-guide/",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    note: "Shown recoloured for this app's theme; the artwork files are unmodified.",
  },
  {
    what: "Upstream artwork",
    creator: "Everkinetic",
    creatorUrl: "https://github.com/everkinetic/data",
    source: "Everkinetic data",
    sourceUrl: "https://github.com/everkinetic/data",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    note: "Some first-pose frames are adaptations of Everkinetic artwork.",
  },
] as const;

export function MediaCredits(): JSX.Element {
  return (
    <section className="space-y-3" aria-labelledby="media-credits-heading">
      <p className="eyebrow" id="media-credits-heading">
        Credits
      </p>
      <ul className="space-y-3 rounded-[var(--radius)] border border-border bg-card-alt p-3">
        {CREDITS.map((credit) => (
          <li key={credit.what} className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{credit.what}</p>
            <p className="text-xs leading-relaxed text-subtle">
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={credit.creatorUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {credit.creator}
              </a>
              {" — "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={credit.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {credit.source}
              </a>
              {", licensed "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={credit.licenceUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {credit.licence}
              </a>
              .
            </p>
            <p className="text-xs leading-relaxed text-faint">{credit.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
