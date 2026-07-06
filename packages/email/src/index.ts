export { normalizeEmail, type NormalizedEmail } from "./normalize";
export {
  type EmailMessage,
  type EmailProvider,
  ResendProvider,
  DevProvider,
  getEmailProvider,
} from "./provider";
export {
  CONSENT_TEXT,
  generateToken,
  buildVerificationUrl,
  createVerification,
  verifyToken,
  type VerificationStore,
  type VerificationTokenRecord,
  type VerifyResult,
} from "./verification";
export { PrismaVerificationStore } from "./prismaStore";
