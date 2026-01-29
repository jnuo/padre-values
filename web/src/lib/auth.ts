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
      // Check if user's email is in the allowlist
      if (!user.email) {
        console.log("[Auth] Sign-in denied: no email");
        return false;
      }

      try {
        const result = await sql`
          SELECT profile_id FROM profile_allowed_emails
          WHERE email = ${user.email}
        `;

        if (result.length === 0) {
          console.log(`[Auth] Sign-in denied: ${user.email} not in allowlist`);
          return false;
        }

        console.log(`[Auth] Sign-in allowed: ${user.email}`);

        // Auto-claim profiles for this user
        const profileIds = result.map(
          (r) => (r as { profile_id: string }).profile_id,
        );

        for (const profileId of profileIds) {
          // Check if user_access entry already exists
          const existing = await sql`
            SELECT id FROM user_access
            WHERE user_email = ${user.email} AND profile_id = ${profileId}
          `;

          if (existing.length === 0) {
            // Create user_access entry
            await sql`
              INSERT INTO user_access (user_email, profile_id, access_level)
              VALUES (${user.email}, ${profileId}, 'owner')
              ON CONFLICT (user_email, profile_id) DO NOTHING
            `;
            console.log(
              `[Auth] Claimed profile ${profileId} for ${user.email}`,
            );
          }
        }

        return true;
      } catch (error) {
        console.error("[Auth] Error checking allowlist:", error);
        // Fail closed - deny sign-in if we can't verify the allowlist
        return false;
      }
    },
    async session({ session, token }) {
      // Add user ID to session
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
};
