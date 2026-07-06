import { describe, it, expect } from "vitest";
import { normalizeEmail } from "./normalize";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    const result = normalizeEmail("  User@Example.COM  ");
    expect(result.valid).toBe(true);
    expect(result.normalizedAddress).toBe("user@example.com");
  });

  it("treats gmail plus-addressing as the same address", () => {
    const a = normalizeEmail("user+1@gmail.com");
    const b = normalizeEmail("user@gmail.com");
    expect(a.normalizedAddress).toBe(b.normalizedAddress);
  });

  it("treats gmail dots as insignificant", () => {
    const a = normalizeEmail("u.s.e.r@gmail.com");
    const b = normalizeEmail("user@gmail.com");
    expect(a.normalizedAddress).toBe(b.normalizedAddress);
  });

  it("canonicalizes googlemail.com to gmail.com", () => {
    const a = normalizeEmail("user@googlemail.com");
    expect(a.normalizedAddress).toBe("user@gmail.com");
  });

  it("does not strip plus-addressing for non-gmail domains", () => {
    const result = normalizeEmail("user+tag@example.com");
    expect(result.normalizedAddress).toBe("user@example.com");
  });

  it("flags known disposable domains", () => {
    const result = normalizeEmail("throwaway@mailinator.com");
    expect(result.isDisposable).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("does not flag legitimate domains as disposable", () => {
    const result = normalizeEmail("someone@gmail.com");
    expect(result.isDisposable).toBe(false);
  });

  it("rejects malformed addresses", () => {
    expect(normalizeEmail("not-an-email").valid).toBe(false);
    expect(normalizeEmail("missing@domain").valid).toBe(false);
    expect(normalizeEmail("@missing-local.com").valid).toBe(false);
    expect(normalizeEmail("").valid).toBe(false);
  });
});
