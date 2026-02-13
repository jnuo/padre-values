import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL!);

export const TEST_EMAIL = "e2e-test@viziai.test";
export const TEST_NAME = "E2E Test User";
const TEST_PROFILE_NAME = "E2E Test Profile";

/**
 * Seed a test user with a profile and access grant.
 * Idempotent — safe to call multiple times.
 */
export async function seedTestUser(): Promise<{
  userId: string;
  profileId: string;
}> {
  // Upsert user
  const [user] = await sql`
    INSERT INTO users (email, name)
    VALUES (${TEST_EMAIL}, ${TEST_NAME})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;

  // Upsert profile
  const existing = await sql`
    SELECT id FROM profiles WHERE display_name = ${TEST_PROFILE_NAME}
  `;

  let profileId: string;
  if (existing.length > 0) {
    profileId = existing[0].id;
  } else {
    const [profile] = await sql`
      INSERT INTO profiles (display_name) VALUES (${TEST_PROFILE_NAME})
      RETURNING id
    `;
    profileId = profile.id;
  }

  // Ensure user has access to the profile
  await sql`
    INSERT INTO user_access (user_id_new, profile_id, access_level, granted_by)
    VALUES (${user.id}, ${profileId}, 'owner', ${user.id})
    ON CONFLICT (user_id_new, profile_id) DO NOTHING
  `;

  return { userId: user.id, profileId };
}

/**
 * Delete all tracking_measurements for a given profile.
 */
export async function cleanupTrackingData(profileId: string): Promise<void> {
  await sql`
    DELETE FROM tracking_measurements WHERE profile_id = ${profileId}
  `;
}

/**
 * Full cleanup: remove user, profile, access, and tracking data.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  // Delete in dependency order
  await sql`DELETE FROM tracking_measurements WHERE profile_id IN (
    SELECT profile_id FROM user_access WHERE user_id_new = ${userId}
  )`;
  await sql`DELETE FROM user_access WHERE user_id_new = ${userId}`;
  await sql`DELETE FROM profiles WHERE display_name = ${TEST_PROFILE_NAME}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
