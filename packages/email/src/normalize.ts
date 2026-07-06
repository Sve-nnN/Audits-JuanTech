/**
 * Basic disposable/temporary email domain blocklist (Phase 7, AUTH-02).
 * Not exhaustive — extensible list of the most common throwaway providers.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "yopmail.fr",
  "tempmail.com",
  "temp-mail.org",
  "tempail.com",
  "trashmail.com",
  "throwawaymail.com",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
  "fakeinbox.com",
  "mailnesia.com",
  "maildrop.cc",
  "mintemail.com",
  "mohmal.com",
  "moakt.com",
  "spam4.me",
  "discard.email",
  "throwaway.email",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Gmail treats dots as insignificant and `+tag` as an addressing extension. */
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export interface NormalizedEmail {
  /** Original address, trimmed but otherwise unmodified (case preserved). */
  address: string;
  /** Lowercased, plus-addressing/dot-canonicalized address used for uniqueness. */
  normalizedAddress: string;
  /** Whether the domain is a known disposable/temporary-email provider. */
  isDisposable: boolean;
  /** Whether the address passes basic format validation. */
  valid: boolean;
}

/**
 * Normalizes a raw email string for storage/comparison and flags disposable
 * addresses. Does not throw — always returns a result; check `.valid` before
 * persisting.
 */
export function normalizeEmail(raw: string): NormalizedEmail {
  const address = typeof raw === "string" ? raw.trim() : "";
  const lower = address.toLowerCase();

  if (!EMAIL_REGEX.test(lower) || !lower.includes("@")) {
    return { address, normalizedAddress: lower, isDisposable: false, valid: false };
  }

  const atIndex = lower.lastIndexOf("@");
  const localPart = lower.slice(0, atIndex);
  const domain = lower.slice(atIndex + 1);

  if (localPart.length === 0 || domain.length === 0) {
    return { address, normalizedAddress: lower, isDisposable: false, valid: false };
  }

  const isDisposable = DISPOSABLE_DOMAINS.has(domain);

  let normalizedLocal = localPart;
  const plusIndex = normalizedLocal.indexOf("+");
  if (plusIndex !== -1) {
    normalizedLocal = normalizedLocal.slice(0, plusIndex);
  }

  const normalizedDomain = GMAIL_DOMAINS.has(domain) ? "gmail.com" : domain;
  if (GMAIL_DOMAINS.has(domain)) {
    normalizedLocal = normalizedLocal.replace(/\./g, "");
  }

  if (normalizedLocal.length === 0) {
    return { address, normalizedAddress: lower, isDisposable, valid: false };
  }

  return {
    address,
    normalizedAddress: `${normalizedLocal}@${normalizedDomain}`,
    isDisposable,
    valid: true,
  };
}
