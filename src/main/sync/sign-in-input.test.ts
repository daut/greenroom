import { describe, expect, it } from "vitest";
import { parseSignInInput } from "./sign-in-input";

describe("parseSignInInput", () => {
  it("reads a 6-digit code", () => {
    expect(parseSignInInput(" 123 456 ")).toEqual({ kind: "code", code: "123456" });
  });

  it("reads the tokens from a pasted magic link", () => {
    const link =
      "http://localhost:3000/#access_token=aaa.bbb.ccc&expires_at=1&expires_in=3600&refresh_token=rrr&token_type=bearer&type=signup";

    expect(parseSignInInput(link)).toEqual({
      kind: "session",
      accessToken: "aaa.bbb.ccc",
      refreshToken: "rrr",
    });
  });

  it("reads a token_hash link (verify URL style)", () => {
    expect(
      parseSignInInput("https://x.supabase.co/auth/v1/verify?token_hash=hhh&type=magiclink"),
    ).toEqual({ kind: "token_hash", tokenHash: "hhh", type: "magiclink" });
  });

  it("explains an expired or failed link", () => {
    expect(() =>
      parseSignInInput(
        "http://localhost:3000/#error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toThrow("Email link is invalid or has expired");
  });

  it("rejects anything else", () => {
    expect(() => parseSignInInput("hello")).toThrow("6-digit code");
  });
});
