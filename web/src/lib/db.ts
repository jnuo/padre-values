import { neon } from "@neondatabase/serverless";

// Create a SQL query function using Neon serverless driver
const sql = neon(process.env.NEON_DATABASE_URL!);

export { sql };
