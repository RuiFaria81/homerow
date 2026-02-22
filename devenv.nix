{ pkgs, ... }:

let
  # [FIX] Updated hash to match the actual file from Maven Central
  greenmailJar = pkgs.fetchurl {
    url = "https://repo1.maven.org/maven2/com/icegreen/greenmail-standalone/2.0.0/greenmail-standalone-2.0.0.jar";
    sha256 = "sha256-h0suLsa7I9QKSxLkKR9jRkraozjxEvIcbOBBYAFPYmI=";
  };
in {
  # 1. Environment Variables for Local Dev
  env.IMAP_HOST = "127.0.0.1";
  env.IMAP_PORT = "3143"; # GreenMail Default
  env.SMTP_HOST = "127.0.0.1";
  env.SMTP_PORT = "3025"; # GreenMail Default
  env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  # Sync Engine env vars (local dev)
  env.DB_HOST = "127.0.0.1";
  env.DB_PORT = "5432";
  env.DB_NAME = "mailsync";
  env.DB_USER = "mailsync";
  env.DB_PASSWORD = "mailsync";
  env.IMAP_USER = "admin@local";
  env.IMAP_PASS = "password";
  env.IMAP_TLS = "false";
  env.ATTACHMENT_DIR = "/tmp/mail-sync-attachments";

  # 2. Tools available in your shell
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.pnpm
    pkgs.jdk17_headless # Required for GreenMail
    pkgs.terraform
    pkgs.openssh
    pkgs.git
  ];

  # 3. PostgreSQL for Sync Engine (local dev)
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_16;
    listen_addresses = "127.0.0.1";
    initialDatabases = [
      { name = "mailsync"; }
    ];
    initialScript = ''
      CREATE USER mailsync WITH PASSWORD 'mailsync';
      GRANT ALL PRIVILEGES ON DATABASE mailsync TO mailsync;
      ALTER DATABASE mailsync OWNER TO mailsync;
    '';
  };

  # 4. Scripts
  scripts.install-deps.exec = "cd webmail && pnpm install";
  scripts.install-sync-deps.exec = "cd sync-engine && pnpm install";
  scripts.db-init.exec = "PGPASSWORD=mailsync psql -h 127.0.0.1 -U mailsync -d mailsync -f sync-engine/schema.sql";

  # 5. Background Processes (Started with 'devenv up')
  processes = {
    # Mock Mail Server
    mail-server.exec = ''
      ${pkgs.jdk17_headless}/bin/java \
        -Dgreenmail.setup.test.all \
        -Dgreenmail.hostname=127.0.0.1 \
        -Dgreenmail.auth.disabled=true \
        -Dgreenmail.verbose \
        -jar ${greenmailJar}
    '';

    # Webmail Client
    webmail.exec = ''
      cd webmail
      if [ ! -d "node_modules" ]; then pnpm install; fi
      pnpm dev
    '';

    # Sync Engine (starts after a delay to let GreenMail and Postgres boot)
    sync-engine.exec = ''
      sleep 5
      cd sync-engine
      if [ ! -d "node_modules" ]; then pnpm install; fi
      mkdir -p /tmp/mail-sync-attachments
      pnpm dev
    '';
  };
}
