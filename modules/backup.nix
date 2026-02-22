{ config, pkgs, ... }:
let
  postgresBackupDir = "/var/backup/postgresql";
in

{
  environment.systemPackages = [ pkgs.restic pkgs.postgresql_16 ];

  systemd.tmpfiles.rules = [
    "d ${postgresBackupDir} 0700 postgres postgres -"
  ];

  systemd.services.postgres-backup = {
    description = "Create PostgreSQL backup snapshots";
    after = [ "postgresql.service" ];
    requires = [ "postgresql.service" ];
    path = [ pkgs.postgresql_16 pkgs.coreutils pkgs.findutils pkgs.gnugrep ];

    serviceConfig = {
      Type = "oneshot";
      User = "postgres";
      Group = "postgres";
      UMask = "0077";
    };

    script = ''
      set -euo pipefail

      timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
      snapshot_dir="${postgresBackupDir}/''${timestamp}"
      tmp_dir="$(mktemp -d ${postgresBackupDir}/.tmp-''${timestamp}-XXXXXX)"
      trap 'rm -rf "$tmp_dir"' EXIT

      pg_dumpall --globals-only > "$tmp_dir/globals.sql"
      pg_dump -d mailsync -Fc -f "$tmp_dir/mailsync.dump"

      mv "$tmp_dir" "$snapshot_dir"

      # Keep a short local history; long-term retention is handled by restic.
      old_snapshots="$(${pkgs.findutils}/bin/find ${postgresBackupDir} -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | ${pkgs.gnugrep}/bin/grep -E '^[0-9]{8}T[0-9]{6}Z$' | ${pkgs.coreutils}/bin/sort | ${pkgs.coreutils}/bin/head -n -7 || true)"
      if [ -n "$old_snapshots" ]; then
        while IFS= read -r d; do
          rm -rf "${postgresBackupDir}/$d"
        done <<< "$old_snapshots"
      fi
    '';
  };

  systemd.timers.postgres-backup = {
    description = "Run PostgreSQL backup snapshot";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnCalendar = "02:45";
      Persistent = true;
      Unit = "postgres-backup.service";
    };
  };

  services.restic.backups.mail-server = {
    initialize = true;
    user = "root";

    paths = [
      "/var/vmail"
      "/var/lib/acme"
      "/var/lib/dhparams"
      postgresBackupDir
    ];

    repositoryFile = "/root/restic-repo";
    passwordFile = "/root/restic-password";
    environmentFile = "/root/restic-env";

    timerConfig = {
      OnCalendar = "03:00";
      Persistent = true;
    };

    pruneOpts = [
      "--keep-daily 7"
      "--keep-weekly 4"
      "--keep-monthly 6"
    ];
  };
}
