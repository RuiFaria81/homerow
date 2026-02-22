process.env.BETTER_AUTH_DISABLE_SIGNUP = "false";

import { betterAuth } from "better-auth";
import pg from "pg";

const email = process.env.AUTH_SEED_EMAIL ?? "admin@inout.email";
const password = process.env.AUTH_SEED_PASSWORD ?? "change-me-now-123";
const name = process.env.AUTH_SEED_NAME ?? "Admin";

const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL || "http://localhost:3000",
  database: new pg.Pool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "mailsync",
    user: process.env.DB_USER || "mailsync",
    password: process.env.DB_PASSWORD || "mailsync",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
  },
});

async function main() {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
      headers: new Headers(),
    });

    if (result?.user?.email) {
      console.log(`Seeded auth user: ${result.user.email}`);
      return;
    }

    console.log(`Seed request completed for: ${email}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already")) {
      console.log(`User already exists: ${email}`);
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("Failed to seed auth user:", error);
  process.exit(1);
});
