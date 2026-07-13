// ─────────────────────────────────────────────────────────────
//  Shared story parsing utilities
//
//  SINGLE SOURCE OF TRUTH for how story content is parsed.
//  Both the author portal (validation at submit time) and the
//  DPF engine (splitting at generation time) import from here,
//  so the two can never disagree about what counts as a valid
//  scene break or placeholder. If the parser changes, it changes
//  in exactly one place for both consumers.
//
//  This directly addresses the merge-review concern: "The Author
//  Portal and DPF Engine should use exactly the same parser.
//  Otherwise one accepts something the other rejects."
// ─────────────────────────────────────────────────────────────

// Scene break marker. Matches [SCENE] case-insensitively and
// tolerates surrounding whitespace inside the brackets (e.g.
// "[SCENE]", "[scene]", "[ SCENE ]") so a stray space never
// causes the author portal and DPF engine to count differently.
const SCENE_MARKER_REGEX = /\[\s*scene\s*\]/gi;

// Placeholder pattern. Deliberately snake_case only: every field
// in personalization_fields is snake_case (favourite_animal,
// best_friend_name). Rejecting camelCase / hyphens is intentional —
// it catches typos that could never match a real field, rather
// than silently accepting a placeholder that will never resolve.
const PLACEHOLDER_REGEX = /\{\{([a-z][a-z0-9_]*)\}\}/g;

// Identity placeholders — always available from the child record
// itself, never treated as required personalisation fields.
export const IDENTITY_PLACEHOLDERS = new Set(['child_name', 'child_age', 'child_photo']);

/**
 * Count the scene-break markers in a story's content.
 * N scenes require N-1 breaks between them.
 */
export function countSceneMarkers(content: string): number {
  const matches = content.match(SCENE_MARKER_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Split content into individual scenes at the scene markers.
 * Trims each scene and drops empty ones.
 */
export function splitIntoScenes(content: string): string[] {
  return content
    .split(SCENE_MARKER_REGEX)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract every distinct placeholder key from content.
 */
export function extractPlaceholders(content: string): string[] {
  const keys: string[] = [];
  let match;
  // Reset lastIndex since the regex is global and module-level.
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return [...new Set(keys)];
}

/**
 * Extract placeholders that should become required story_fields —
 * i.e. all placeholders except identity ones.
 */
export function extractRequiredFieldKeys(content: string): string[] {
  return extractPlaceholders(content).filter((k) => !IDENTITY_PLACEHOLDERS.has(k));
}
