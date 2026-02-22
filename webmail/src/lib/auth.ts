import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import pg from "pg";

const baseURL = process.env.BETTER_AUTH_BASE_URL || "http://localhost:3000";
const trustedOrigins = Array.from(
  new Set(
    [
      baseURL,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ],
  ),
);

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  database: new pg.Pool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "mailsync",
    user: process.env.DB_USER || "mailsync",
    password: process.env.DB_PASSWORD || "mailsync",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.BETTER_AUTH_DISABLE_SIGNUP !== "false",
  },
  plugins: [
    twoFactor({
      issuer: "Homerow",
    }),
  ],
});
