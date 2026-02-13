import { hkdfSync } from "crypto";
import { EncryptJWT } from "jose";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { TEST_EMAIL, TEST_NAME } from "./db";

/**
 * Derive the encryption key NextAuth v4 uses for JWE tokens.
 * Matches: https://github.com/nextauthjs/next-auth/blob/main/packages/next-auth/src/jwt/index.ts
 */
function getDerivedEncryptionKey(secret: string): Uint8Array {
  return new Uint8Array(
    hkdfSync("sha256", secret, "", "NextAuth.js Generated Encryption Key", 32),
  );
}

/**
 * Create an encrypted JWT cookie value matching NextAuth v4's format.
 * The middleware's `getToken({ req, secret })` will decrypt and validate this.
 */
export async function createSessionCookie(
  dbId: string,
  email: string,
  name: string,
): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");

  const encryptionKey = getDerivedEncryptionKey(secret);
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 30 * 24 * 60 * 60; // 30 days

  // email and name are required — requireAuth() checks session.user.email
  return new EncryptJWT({
    sub: dbId,
    dbId,
    email,
    name,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(now + maxAge)
    .encrypt(encryptionKey);
}

/**
 * Create a browser context with auth and profile cookies pre-set,
 * then open a new page. Call `context.close()` when done.
 */
export async function authenticatedContext(
  browser: Browser,
  dbId: string,
  profileId: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const token = await createSessionCookie(dbId, TEST_EMAIL, TEST_NAME);
  const context = await browser.newContext();

  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "viziai_active_profile",
      value: profileId,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  return { context, page };
}
