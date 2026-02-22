import { createEffect, createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authClient } from "~/lib/auth-client";

export default function Login() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [twoFactorCode, setTwoFactorCode] = createSignal("");
  const [backupCode, setBackupCode] = createSignal("");
  const [useBackupCode, setUseBackupCode] = createSignal(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = createSignal(false);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    if (session().data?.session) {
      navigate("/");
    }
  });

  const handleCredentialsSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email: email(),
        password: password(),
        callbackURL: "/",
      });

      if (result.error) {
        setError(result.error.message || "Invalid email or password");
        return;
      }

      const twoFactorRedirect = Boolean((result.data as { twoFactorRedirect?: boolean } | undefined)?.twoFactorRedirect);
      if (twoFactorRedirect) {
        setRequiresTwoFactor(true);
        return;
      }

      navigate("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const code = useBackupCode() ? backupCode().trim() : twoFactorCode().trim();
      if (!code) {
        setError(useBackupCode() ? "Enter a backup code" : "Enter your authenticator code");
        return;
      }

      const result = useBackupCode()
        ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: true });

      if (result.error) {
        setError(result.error.message || "Invalid authentication code");
        return;
      }

      setTwoFactorCode("");
      setBackupCode("");
      navigate("/");
    } catch {
      setError("Could not verify second factor. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div class="w-full max-w-sm">
        <div class="flex items-center justify-center gap-3 mb-8">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4285f4] via-[#34a853] to-[#ea4335] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            M
          </div>
          <span class="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Nix Mail
          </span>
        </div>

        <div class="bg-[var(--card)] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[var(--border-light)] p-8">
          <h1 class="text-lg font-semibold text-[var(--foreground)] mb-1">
            {requiresTwoFactor() ? "Two-step verification" : "Sign in"}
          </h1>
          <p class="text-sm text-[var(--text-secondary)] mb-6">
            {requiresTwoFactor()
              ? "Enter the code from your authenticator app or a backup code"
              : "Enter your credentials to access your mailbox"}
          </p>

          <Show when={error()}>
            <div class="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error()}
            </div>
          </Show>

          <Show
            when={requiresTwoFactor()}
            fallback={
              <form onSubmit={handleCredentialsSubmit} class="flex flex-col gap-4">
                <div>
                  <label
                    for="email"
                    class="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    class="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div>
                  <label
                    for="password"
                    class="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    class="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading()}
                  class="w-full h-10 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading() ? "Signing in..." : "Sign in"}
                </button>
              </form>
            }
          >
            <form onSubmit={handleTwoFactorSubmit} class="flex flex-col gap-4">
              <div class="flex items-center gap-4 text-sm">
                <button
                  type="button"
                  class={`cursor-pointer ${!useBackupCode() ? "text-[var(--primary)] font-semibold" : "text-[var(--text-secondary)]"}`}
                  onClick={() => setUseBackupCode(false)}
                >
                  Authenticator code
                </button>
                <button
                  type="button"
                  class={`cursor-pointer ${useBackupCode() ? "text-[var(--primary)] font-semibold" : "text-[var(--text-secondary)]"}`}
                  onClick={() => setUseBackupCode(true)}
                >
                  Backup code
                </button>
              </div>

              <Show
                when={!useBackupCode()}
                fallback={
                  <input
                    id="backup-code"
                    type="text"
                    required
                    placeholder="Enter backup code"
                    value={backupCode()}
                    onInput={(e) => setBackupCode(e.currentTarget.value)}
                    class="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 placeholder:text-[var(--text-muted)]"
                  />
                }
              >
                <input
                  id="two-factor-code"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  required
                  maxlength={8}
                  placeholder="Enter 6-digit code"
                  value={twoFactorCode()}
                  onInput={(e) => setTwoFactorCode(e.currentTarget.value.replace(/\D+/g, ""))}
                  class="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 placeholder:text-[var(--text-muted)]"
                />
              </Show>

              <button
                type="submit"
                disabled={loading()}
                class="w-full h-10 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading() ? "Verifying..." : "Verify and sign in"}
              </button>

              <button
                type="button"
                class="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm font-semibold cursor-pointer text-[var(--foreground)]"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setError("");
                  setTwoFactorCode("");
                  setBackupCode("");
                }}
              >
                Back
              </button>
            </form>
          </Show>
        </div>
      </div>
    </div>
  );
}
