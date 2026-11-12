import { describe, expect, it } from "vitest";

import {
  confirmLinkSchema,
  fieldErrorsFrom,
  setPasswordSchema,
  signInSchema,
} from "@/features/auth/schemas";

describe("signInSchema", () => {
  it("normaliza o e-mail", () => {
    const parsed = signInSchema.parse({ email: "  Fulano@Example.COM ", password: "x" });
    expect(parsed.email).toBe("fulano@example.com");
  });

  it("recusa e-mail inválido e senha vazia", () => {
    const result = signInSchema.safeParse({ email: "nao-e-email", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrorsFrom(result.error)).sort()).toEqual(["email", "password"]);
    }
  });
});

describe("setPasswordSchema", () => {
  it("aceita senha longa com letras e números", () => {
    expect(
      setPasswordSchema.safeParse({ password: "republica2007", confirmation: "republica2007" }).success,
    ).toBe(true);
  });

  it.each([
    ["curta", "abc123", "abc123"],
    ["sem número", "somenteletras", "somenteletras"],
    ["sem letra", "1234567890123", "1234567890123"],
    ["confirmação diferente", "republica2007", "republica2008"],
  ])("recusa senha %s", (_label, password, confirmation) => {
    expect(setPasswordSchema.safeParse({ password, confirmation }).success).toBe(false);
  });
});

describe("confirmLinkSchema", () => {
  it("só aceita tipos de link conhecidos", () => {
    expect(confirmLinkSchema.safeParse({ token_hash: "a".repeat(40), type: "invite" }).success).toBe(true);
    expect(confirmLinkSchema.safeParse({ token_hash: "a".repeat(40), type: "signup" }).success).toBe(false);
    expect(confirmLinkSchema.safeParse({ token_hash: "", type: "invite" }).success).toBe(false);
  });
});
