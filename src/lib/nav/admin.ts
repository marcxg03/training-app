// The admin hub's navigation model (T3-A).
//
// Pure data + a pure predicate, deliberately separated from the sidebar
// component so both can be unit-tested without React (the repo idiom — see
// src/lib/nav/tabs.ts, which does the same for the mobile tab bar).
//
// WHY A SEPARATE NAV AT ALL: the hub is owner-only and DESKTOP-first (D18),
// while the member app is a phone app with a bottom tab bar. They are two
// different products wearing the same design tokens, so they get two
// different navigation models rather than one that tries to be both.

export type AdminSection = {
  href: string;
  label: string;
  /** One line under the label in the sidebar — what the section is FOR. */
  hint: string;
  /** Lucide icon name, resolved by the component (keeps this module pure). */
  icon: "gauge" | "folder" | "chart" | "users";
  /** Not yet built — rendered muted, with a "soon" chip. */
  soon?: boolean;
};

/**
 * The hub's sections, in sidebar order.
 *
 * `soon` is honest signalling, not decoration: a section that renders a real
 * route but has no feature behind it must LOOK unbuilt, or the hub lies about
 * its own state — which is exactly what the four "Soon" cards on the old stub
 * were for. Clear the flag in the slice that builds the section.
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    href: "/admin",
    label: "Overview",
    hint: "What needs attention",
    icon: "gauge",
  },
  {
    href: "/admin/programs",
    label: "Programs",
    hint: "Create, publish, archive",
    icon: "folder",
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    hint: "Training health",
    icon: "chart",
    soon: true,
  },
  {
    href: "/admin/members",
    label: "Members",
    hint: "Subscribers and adherence",
    icon: "users",
    soon: true,
  },
];

/**
 * Is `href` the active section for `pathname`?
 *
 * Exact match for the hub root, prefix match for everything else. Without the
 * root special-case "/admin" would light up on every child route and the
 * sidebar would show two active items at once — the same class of bug
 * isTabActive() exists to prevent on mobile, but it cannot be reused here
 * because it is deliberately prefix-only.
 */
export function isAdminSectionActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The section whose route is currently rendered, or null outside the hub. */
export function activeAdminSection(pathname: string): AdminSection | null {
  return (
    ADMIN_SECTIONS.find((section) =>
      isAdminSectionActive(pathname, section.href),
    ) ?? null
  );
}
