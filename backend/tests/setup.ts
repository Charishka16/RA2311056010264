import 'dotenv/config';
export default async function setup() {
  // Ensure test env uses the same DB
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
}
