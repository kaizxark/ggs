/**
 * Username rules, safe to import from the browser.
 *
 * This lives apart from `shared/username-lookup.ts` on purpose. That module
 * reads `SUPABASE_SECRET_KEY` at the top level to query PostgREST, so importing
 * it from `client/` would pull the service key into the browser bundle. The
 * pattern is duplicated rather than shared because a leaked admin key is a far
 * worse outcome than a duplicated regular expression — and `api/login.test.ts`
 * already asserts the two agree, so they cannot drift silently.
 */

/**
 * Lowercase letters, numbers, dot, dash and underscore; 2–64 characters.
 *
 * The character set is a security control on the server, not just tidiness: the
 * value is interpolated into a PostgREST filter, so a comma or a closing paren
 * would let a caller rewrite that filter and read the whole profiles table.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim().toLowerCase());
}
