import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Training",
    short_name: "Training",
    description:
      "Block + bank lifting, schedule-anchored nutrition, and append-only PR history.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Match the LIGHT theme the app actually ships (--background #FFFFFF).
    // These were #0A0A0B, left over from the pre-redesign dark palette, which
    // gave the installed PWA a black splash screen and a black status bar in
    // front of a white app — the most visible thing about an install, and the
    // one part of the app a browser renders before any of our CSS runs.
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
