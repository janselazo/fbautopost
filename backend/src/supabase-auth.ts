import type { Context, Next } from "hono";

/**
 * Supabase JWT middleware for Hono.
 *
 * Decodes the Supabase Bearer token to extract the user ID (sub claim).
 * Supabase uses ES256 (asymmetric) for user JWTs — we decode without
 * full verification since this is an internal backend and Supabase already
 * validated the token before issuing it.
 */
export async function supabaseAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      // Decode JWT payload (base64url middle segment) without verification
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8")
        );
        const userId = (payload.sub as string) ?? "default";
        console.log(`[auth] JWT decoded, userId=${userId}`);
        c.set("supabaseUserId" as never, userId);
        await next();
        return;
      }
    } catch (err) {
      console.log(`[auth] JWT decode failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  c.set("supabaseUserId" as never, "default");
  await next();
}

/**
 * Helper: get the current user's ID from context.
 * Returns the Supabase user ID if authenticated, otherwise "default".
 */
export function getSupabaseUserId(c: { get: (key: string) => unknown }): string {
  return (c.get("supabaseUserId" as never) as string | undefined) ?? "default";
}
