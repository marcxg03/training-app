import { redirect } from "next/navigation";

import { liftingHref } from "@/lib/library/crossLinks";

export default function LibraryIndexPage() {
  redirect(liftingHref());
}
