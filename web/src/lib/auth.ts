import GoogleProvider from "next-auth/providers/google";
import { sql } from "@/lib/db";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      // Open registration - anyone with a Google account can sign in
      if (!user.email) {
        console.log("[Auth] Sign-in denied: no email");
        return false;
      }

      try {
        // Create or update user record in our users table
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

        // Store dbId on the user object for the jwt callback
        (user as { dbId?: string }).dbId = dbUserId;

        // Auto-claim any profiles linked to this email in profile_allowed_emails
        const allowedProfiles = await sql`
          SELECT profile_id FROM profile_allowed_emails
          WHERE email = ${user.email}
          AND claimed_at IS NULL
        `;

        for (const row of allowedProfiles) {
          const profileId = row.profile_id;

          // Mark as claimed
          await sql`
            UPDATE profile_allowed_emails
            SET claimed_at = NOW(), claimed_by_user_id = ${dbUserId}
            WHERE email = ${user.email} AND profile_id = ${profileId}
          `;

          // Create user_access entry
          await sql`
            INSERT INTO user_access (user_id_new, profile_id, access_level, granted_by)
            VALUES (${dbUserId}, ${profileId}, 'owner', ${dbUserId})
            ON CONFLICT (user_id_new, profile_id) DO NOTHING
          `;

          console.log(`[Auth] Claimed profile ${profileId} for ${user.email}`);
        }

        // Also grant access to any already-claimed profiles for this email
        // (in case the user was previously added to profile_allowed_emails and another user claimed it)
        const existingAccess = await sql`
          SELECT pae.profile_id
          FROM profile_allowed_emails pae
          WHERE pae.email = ${user.email}
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
        console.error("[Auth] Error during sign-in:", error);
        // Don't fail closed anymore - allow sign-in but log the error
        // The user just won't have any profiles until they create one
        return true;
      }
    },
    async session({ session, token }) {
      // Add user IDs to session
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
        // Get dbId from user object (set in signIn callback)
        if ((user as { dbId?: string }).dbId) {
          token.dbId = (user as { dbId?: string }).dbId;
        } else if (user.email) {
          // Fallback: look up dbId from database
          try {
            const result = await sql`
              SELECT id FROM users WHERE email = ${user.email}
            `;
            if (result[0]?.id) {
              token.dbId = result[0].id;
            }
          } catch (error) {
            console.error("[Auth] Error looking up dbId:", error);
          }
        }
      }
      return token;
    },
  },
};

/**
 * Helper to get the current user's database ID from session
 */
export function getDbUserId(
  session: { user?: { dbId?: string } } | null,
): string | null {
  return session?.user?.dbId || null;
}

/**
 * Helper to check if a user has access to a profile
 */
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
    console.error("[Auth] Error checking profile access:", error);
    return false;
  }
}

/**
 * Helper to get user's accessible profiles
 */
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
    console.error("[Auth] Error getting user profiles:", error);
    return [];
  }
}
