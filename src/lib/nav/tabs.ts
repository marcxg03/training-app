/**
 * Pure nav-active matching, extracted from BottomTabBar so it can be unit-tested
 * (the component itself is a client module importing next/navigation + lucide).
 * A tab is active when the current path equals, or is nested under, its href OR
 * any of its `activeMatch` prefixes (the surfaces merged into that tab).
 */
export function isTabActive(
  pathname: string,
  href: string,
  activeMatch?: string[],
): boolean {
  const prefixes = [href, ...(activeMatch ?? [])];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
