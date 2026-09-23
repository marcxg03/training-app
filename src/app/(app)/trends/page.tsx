import { redirect } from "next/navigation";

/**
 * /trends — merged into the Progress tab (D19/S5).
 *
 * Trends is no longer its own surface: its strength / load / fuel / body
 * sections were re-homed into /progress (the Trends segment). This route
 * redirects so old links and the Progress tab's activeMatch still resolve.
 * The trend section COMPONENTS live on in _components/ and are imported by
 * /progress — only this index page redirects.
 */
export default function TrendsPage() {
  redirect("/progress");
}
