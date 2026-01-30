import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "";

export const pool = new Pool({
  connectionString: databaseUrl
});

export async function query<T>(text: string, params?: Array<string | number | number[]>) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const result = await pool.query<T>(text, params);
  return result.rows;
}
