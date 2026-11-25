export type SignInInput =
  | { kind: "code"; code: string }
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "token_hash"; tokenHash: string; type: "magiclink" | "signup" | "email" };

/**
 * What the user pasted from the sign-in email: a 6-digit code, or the whole link
 * (Supabase's default templates send a link that redirects to the project's Site URL).
 */
export function parseSignInInput(raw: string): SignInInput {
  const input = raw.trim();
  const digits = input.replace(/\s+/g, "");
  if (/^\d{6,10}$/.test(digits)) return { kind: "code", code: digits };

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Paste the 6-digit code or the whole link from the email.");
  }
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  for (const [key, value] of url.searchParams) if (!params.has(key)) params.set(key, value);

  const error = params.get("error_description") ?? params.get("error");
  if (error) throw new Error(error);

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken };

  const tokenHash = params.get("token_hash") ?? params.get("token");
  if (tokenHash) {
    const type = params.get("type");
    return {
      kind: "token_hash",
      tokenHash,
      type: type === "signup" || type === "magiclink" ? type : "email",
    };
  }
  throw new Error("That link has no sign-in details. Request a new email and paste its link.");
}
