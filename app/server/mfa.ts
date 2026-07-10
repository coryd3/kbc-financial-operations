import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";

function encryptionKey(): Buffer {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("MFA_ENCRYPTION_KEY must be set in production");
  }
  return crypto.createHash("sha256").update(configured || "kbc-local-mfa-key").digest();
}

export function encryptMfaSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMfaSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted MFA secret");
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function verifyMfaToken(secret: string, token: string): boolean {
  return authenticator.check(token.replace(/\s/g, ""), secret);
}

export async function mfaQrDataUrl(username: string, secret: string): Promise<string> {
  const uri = authenticator.keyuri(username, "KBC Operations Portal", secret);
  return QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}
