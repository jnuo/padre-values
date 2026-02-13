import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import { sql } from "@/lib/db";
import { reportError } from "@/lib/error-reporting";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        console.log("[Auth] Sign-in denied: no email");
        return false;
      }

      try {
        console.log(`[Auth] Sign-in for email: "${user.email}"`);

        const result = await sql`
          INSERT INTO users (email, name, avatar_url)
          VALUES (${user.email}, ${user.name || null}, ${user.image || null})
          ON CONFLICT (email) DO UPDATE
          SET
            name = COALESCE(EXCLUDED.name, users.name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
            updated_at = NOW()
          RETURNING id
        `;

        const dbUserId = result[0]?.id;
        if (!dbUserId) {
          console.error("[Auth] Failed to create/get user record");
          return false;
        }

        console.log(
          `[Auth] User record created/updated: ${user.email} -> ${dbUserId}`,
        );

        (user as { dbId?: string }).dbId = dbUserId;

        // Auto-claim unclaimed profiles linked to this email
        const allowedProfiles = await sql`
          SELECT profile_id FROM profile_allowed_emails
          WHERE LOWER(email) = LOWER(${user.email})
          AND claimed_at IS NULL
        `;

        for (const row of allowedProfiles) {
          const profileId = row.profile_id;

          await sql`
            UPDATE profile_allowed_emails
            SET claimed_at = NOW(), claimed_by_user_id = ${dbUserId}
            WHERE LOWER(email) = LOWER(${user.email}) AND profile_id = ${profileId}
          `;

          await sql`
            INSERT INTO user_access (user_id_new, profile_id, access_level, granted_by)
            VALUES (${dbUserId}, ${profileId}, 'owner', ${dbUserId})
            ON CONFLICT (user_id_new, profile_id) DO NOTHING
          `;

          console.log(`[Auth] Claimed profile ${profileId} for ${user.email}`);
        }

        // Grant viewer access to already-claimed profiles for this email
        const existingAccess = await sql`
          SELECT pae.profile_id
          FROM profile_allowed_emails pae
          WHERE LOWER(pae.email) = LOWER(${user.email})
          AND pae.profile_id NOT IN (
            SELECT profile_id FROM user_access WHERE user_id_new = ${dbUserId}
          )
        `;

        for (const row of existingAccess) {
          await sql`
            INSERT INTO user_access (user_id_new, profile_id, access_level, granted_by)
            VALUES (${dbUserId}, ${row.profile_id}, 'viewer', ${dbUserId})
            ON CONFLICT (user_id_new, profile_id) DO NOTHING
          `;
          console.log(
            `[Auth] Granted access to profile ${row.profile_id} for ${user.email}`,
          );
        }

        console.log(`[Auth] Sign-in allowed: ${user.email}`);
        return true;
      } catch (error) {
        reportError(error, { op: "auth.signIn", email: user.email });
        return false;
      }
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        if (token.dbId) {
          session.user.dbId = token.dbId as string;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        if ((user as { dbId?: string }).dbId) {
          token.dbId = (user as { dbId?: string }).dbId;
        } else if (user.email) {
          try {
            const result = await sql`
              SELECT id FROM users WHERE LOWER(email) = LOWER(${user.email})
            `;
            if (result[0]?.id) {
              token.dbId = result[0].id;
            }
          } catch (error) {
            reportError(error, {
              op: "auth.jwt.lookupDbId",
              email: user.email,
            });
          }
        }
      }
      return token;
    },
  },
};

export function getDbUserId(
  session: { user?: { dbId?: string } } | null,
): string | null {
  return session?.user?.dbId || null;
}

export async function hasProfileAccess(
  userId: string,
  profileId: string,
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT id FROM user_access
      WHERE user_id_new = ${userId} AND profile_id = ${profileId}
    `;
    return result.length > 0;
  } catch (error) {
    reportError(error, { op: "auth.hasProfileAccess", userId, profileId });
    return false;
  }
}

export async function getProfileAccessLevel(
  userId: string,
  profileId: string,
): Promise<"owner" | "editor" | "viewer" | null> {
  try {
    const result = await sql`
      SELECT access_level FROM user_access
      WHERE user_id_new = ${userId} AND profile_id = ${profileId}
      LIMIT 1
    `;
    if (result.length === 0) return null;
    return result[0].access_level as "owner" | "editor" | "viewer";
  } catch (error) {
    reportError(error, { op: "auth.getProfileAccessLevel", userId, profileId });
    return null;
  }
}

export async function getUserProfiles(userId: string): Promise<
  Array<{
    id: string;
    display_name: string;
    access_level: string;
  }>
> {
  try {
    const result = await sql`
      SELECT p.id, p.display_name, ua.access_level
      FROM profiles p
      JOIN user_access ua ON ua.profile_id = p.id
      WHERE ua.user_id_new = ${userId}
      ORDER BY p.display_name ASC
    `;
    return result as Array<{
      id: string;
      display_name: string;
      access_level: string;
    }>;
  } catch (error) {
    reportError(error, { op: "auth.getUserProfiles", userId });
    return [];
  }
}

export async function requireAuth(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return getDbUserId(session);
}

export async function requireProfileOwner(
  profileId: string,
): Promise<string | null> {
  const userId = await requireAuth();
  if (!userId) return null;

  const level = await getProfileAccessLevel(userId, profileId);
  if (level !== "owner") return null;

  return userId;
}
