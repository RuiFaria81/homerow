{ config, pkgs, lib, ... }:
let
  settings = import ./settings.nix;
  webmailSubdomain = settings.webmailSubdomain or "webmail";
  webmailHost = "${webmailSubdomain}.${settings.domain}";

  customWebmailApp = pkgs.buildNpmPackage {
    pname = "custom-webmail";
    version = "1.0.0";
    src = ../webmail;

    npmDepsHash = "sha256-bv2joWko3x9EqcFK+2erXsLd9WM0oxUL3ue9cT+PH/Y=";
    npmBuildScript = "build";

    installPhase = ''
      mkdir -p $out
      cp -r .output $out/
      cp -r node_modules $out/
    '';
  };

  webmailBluePort = 3001;
  webmailGreenPort = 3002;

  commonEnvironment = {
    HOST = "0.0.0.0";
    BETTER_AUTH_BASE_URL = "https://${webmailHost}";
    BETTER_AUTH_TRUSTED_ORIGINS = "https://${webmailHost},http://localhost:3000,http://127.0.0.1:3000";
    DB_HOST = "127.0.0.1";
    DB_PORT = "5432";
    DB_NAME = "mailsync";
    DB_USER = "mailsync";
    DB_PASSWORD = "${settings.imapPassword}";

    # Mail Server Settings
    IMAP_HOST = "127.0.0.1";
    IMAP_PORT = "993";
    IMAP_TLS = "true";

    SMTP_HOST = "127.0.0.1";
    SMTP_PORT = "465";
    SMTP_SECURE = "true";

    # Explicitly set the user to the full email address
    # We provide multiple common keys to catch whatever the app is looking for
    ADMIN_EMAIL = "${settings.email}";
    SMTP_USER = "${settings.email}";
    IMAP_USER = "${settings.email}";
    USER_EMAIL = "${settings.email}";

    # Use the plain text password from our automated setup
    ADMIN_PASSWORD = "${settings.imapPassword}";
    SMTP_PASS = "${settings.imapPassword}";
    IMAP_PASS = "${settings.imapPassword}";

    AVATAR_STORAGE_DIR = "/var/lib/custom-webmail/avatars";
    TAKEOUT_IMPORT_DIR = "/var/lib/custom-webmail/takeout-imports";
  };

  mkWebmailService = slot: port: {
    description = "Custom SolidStart Webmail (${slot})";
    wantedBy = [ "multi-user.target" ];
    after = [ "network.target" "dovecot2.service" "postfix.service" ];

    environment = commonEnvironment // {
      PORT = toString port;
      WEBMAIL_SLOT = slot;
    };

    # Keep instances running during nixos-rebuild switch; deploy script restarts
    # each slot one-by-one after switch for rolling updates.
    restartIfChanged = false;

    serviceConfig = {
      ExecStart = "${pkgs.nodejs}/bin/node ${customWebmailApp}/.output/server/index.mjs";
      User = "webmail";
      Group = "webmail";
      StateDirectory = "custom-webmail";
      Restart = "always";
      RestartSec = "10s";
      NoNewPrivileges = true;
      PrivateTmp = true;
      ProtectSystem = "full";
      ProtectHome = true;
      ProtectKernelTunables = true;
      ProtectKernelModules = true;
      ProtectControlGroups = true;
      RestrictSUIDSGID = true;
      LockPersonality = true;
      RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" ];
      UMask = "0077";
    };
  };
in {
  users.users.webmail = {
    isSystemUser = true;
    group = "webmail";
    extraGroups = [ "mailsync" ];
    description = "Custom Webmail Service User";
  };
  users.groups.webmail = {};

  systemd.services.custom-webmail-auth-bootstrap = {
    description = "Bootstrap Better Auth schema and admin user for webmail";
    wantedBy = [ "multi-user.target" ];
    before = [ "custom-webmail-blue.service" "custom-webmail-green.service" ];
    requiredBy = [ "custom-webmail-blue.service" "custom-webmail-green.service" ];
    after = [ "postgresql.service" "sync-engine-db-init.service" ];
    requires = [ "postgresql.service" "sync-engine-db-init.service" ];

    serviceConfig = {
      Type = "oneshot";
      ExecStart = pkgs.writeShellScript "custom-webmail-auth-bootstrap" ''
        set -euo pipefail

        cd ${customWebmailApp}
        ${pkgs.nodejs}/bin/node --input-type=module <<'JS'
        import { betterAuth } from "better-auth";
        import { twoFactor } from "better-auth/plugins";
        import { getMigrations } from "better-auth/db";
        import { createHash } from "node:crypto";
        import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
        import pg from "pg";

        const adminEmail = "${settings.email}";
        const adminPassword = "${settings.imapPassword}";
        const stateDir = "/var/lib/custom-webmail-auth-bootstrap";
        const passwordHashFile = stateDir + "/admin_password_sha256";

        const baseURL = "https://${webmailHost}";
        const trustedOrigins = [
          baseURL,
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ];

        const pool = new pg.Pool({
          host: "127.0.0.1",
          port: 5432,
          database: "mailsync",
          user: "mailsync",
          password: "${settings.imapPassword}",
        });

        const authConfig = {
          baseURL,
          trustedOrigins,
          database: pool,
          emailAndPassword: {
            enabled: true,
            disableSignUp: false,
          },
          plugins: [
            twoFactor({
              issuer: "Nix Mail",
            }),
          ],
        };

        const migrations = await getMigrations(authConfig);
        await migrations.runMigrations();

        mkdirSync(stateDir, { recursive: true });
        const desiredPasswordHash = createHash("sha256").update(adminPassword).digest("hex");
        const previousPasswordHash = existsSync(passwordHashFile)
          ? readFileSync(passwordHashFile, "utf8").trim()
          : "";
        const passwordChanged = previousPasswordHash !== desiredPasswordHash;

        if (passwordChanged) {
          await pool.query('DELETE FROM "user" WHERE email = $1', [adminEmail]);
          console.log("better-auth: admin password changed, rotated auth user credentials");
        }

        const auth = betterAuth(authConfig);
        try {
          await auth.api.signUpEmail({
            body: {
              email: adminEmail,
              password: adminPassword,
              name: "Admin",
            },
            headers: new Headers(),
          });
          console.log("better-auth: seeded admin user");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("already")) {
            console.log("better-auth: admin user already exists");
          } else {
            throw error;
          }
        } finally {
          writeFileSync(passwordHashFile, desiredPasswordHash + "\n", { encoding: "utf8" });
          await pool.end();
        }
        JS
      '';
    };
  };

  systemd.services.custom-webmail-blue = mkWebmailService "blue" webmailBluePort;
  systemd.services.custom-webmail-green = mkWebmailService "green" webmailGreenPort;

  services.nginx.upstreams.custom-webmail.servers = {
    "127.0.0.1:${toString webmailBluePort}" = {};
    "127.0.0.1:${toString webmailGreenPort}" = {};
  };

  services.nginx.virtualHosts."${webmailHost}" = {
    enableACME = true;
    forceSSL = true;
    locations."/" = {
      proxyPass = "http://custom-webmail";
      proxyWebsockets = true;
      extraConfig = ''
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
      '';
    };
  };
}
