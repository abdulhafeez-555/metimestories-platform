// ─────────────────────────────────────────────────────────────
//  formatName
//
//  Single source of truth for displaying a child's (or parent's)
//  name consistently as Title Case, regardless of how it was
//  originally typed or where it's stored.
//
//  Why this exists as a separate display-time utility, not just
//  a save-time fix in AddChild.tsx:
//    - Children created BEFORE this fix existed (e.g. "child1",
//      "emma") are already sitting in the database with bad
//      casing. A save-time-only fix never corrects those.
//    - Names also pass through places that bypass the save flow
//      entirely — e.g. a name read back from a URL query param
//      on the PIN login page. Formatting at every DISPLAY point
//      guarantees consistency regardless of source, rather than
//      trusting every possible write path to have remembered to
//      format first.
// ─────────────────────────────────────────────────────────────

export function formatName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
