const demoImagePath = `${import.meta.env.BASE_URL}demo-avatar.svg`;

export const DEMO_USER_PROFILE = {
  name: "Demo User",
  email: "demo@homerow.dev",
  image: demoImagePath,
} as const;

export const DEMO_USER_PASSWORD = "demo123";
export const DEMO_AUTH_COOKIE = "homerow_demo_auth";
