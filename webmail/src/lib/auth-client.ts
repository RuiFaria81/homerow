import { createAuthClient } from "better-auth/solid";
import { twoFactorClient } from "better-auth/client/plugins";
import { createSignal } from "solid-js";
import { isDemoModeEnabled, isDemoStaticModeEnabled } from "./demo-mode";
import { DEMO_USER_PASSWORD, DEMO_USER_PROFILE } from "./demo-user";

type SessionValue = {
  session: { id: string };
  user: { email: string; name: string; image?: string | null };
} | null;

const createDemoStaticAuthClient = () => {
  let authenticated = false;
  const [session, setSession] = createSignal<{ data: SessionValue; error: null; isPending: false }>({
    data: null,
    error: null,
    isPending: false,
  });

  const hydrate = () => {
    setSession({
      data: authenticated
        ? {
            session: { id: "demo-session" },
            user: {
              email: DEMO_USER_PROFILE.email,
              name: DEMO_USER_PROFILE.name,
              image: DEMO_USER_PROFILE.image,
            },
          }
        : null,
      error: null,
      isPending: false,
    });
  };

  return {
    useSession: () => {
      hydrate();
      return session;
    },
    signIn: {
      email: async ({ email, password }: { email: string; password: string }) => {
        const validEmail = email.trim().toLowerCase() === DEMO_USER_PROFILE.email.toLowerCase();
        const validPassword = password === DEMO_USER_PASSWORD;
        if (!validEmail || !validPassword) {
          return { data: null, error: { message: "Invalid email or password" } };
        }
        authenticated = true;
        hydrate();
        return { data: { session: { id: "demo-session" } }, error: null };
      },
    },
    signOut: async () => {
      authenticated = false;
      hydrate();
      return { error: null };
    },
    updateUser: async () => ({ error: null }),
    changePassword: async () => ({ error: null }),
    twoFactor: {
      enable: async () => ({ data: null, error: null }),
      verifyTotp: async () => ({ data: null, error: null }),
      verifyBackupCode: async () => ({ data: null, error: null }),
      disable: async () => ({ data: null, error: null }),
      generateBackupCodes: async () => ({ data: { backupCodes: [] as string[] }, error: null }),
    },
  };
};

export const authClient =
  isDemoModeEnabled() && isDemoStaticModeEnabled()
    ? createDemoStaticAuthClient()
    : createAuthClient({
        plugins: [twoFactorClient()],
      });
