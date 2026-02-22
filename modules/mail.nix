{ config, pkgs, ... }:
let
  settings = import ./settings.nix;
  acmeEnvironment = settings.acmeEnvironment or "production";
  acmeServer =
    if acmeEnvironment == "staging"
    then "https://acme-staging-v02.api.letsencrypt.org/directory"
    else "https://acme-v02.api.letsencrypt.org/directory";
in {
  mailserver = {
    enable = true;
    fqdn = "${settings.hostName}.${settings.domain}";
    domains = [ settings.domain ];

    # Must be an integer
    stateVersion = 23;

    loginAccounts = {
      "${settings.email}" = {
        hashedPasswordFile = pkgs.writeText "mail-pass" settings.hashedPassword;
        aliases = [ "postmaster@${settings.domain}" "abuse@${settings.domain}" ];
        # Accept any local-part@domain and deliver to the main mailbox, preserving
        # original recipient headers for downstream label rules.
        catchAll = [ settings.domain ];
      };
    };

    # [FIX] New location for certificate configuration
    x509 = {
      certificateFile = "/var/lib/acme/${settings.hostName}.${settings.domain}/fullchain.pem";
      privateKeyFile = "/var/lib/acme/${settings.hostName}.${settings.domain}/key.pem";
    };

    enableImap = true;
    enableSubmission = true;
    enableSubmissionSsl = true;
    virusScanning = false;
  };

  # ---------------------------------------------------------------------------
  # Rspamd spam filtering tuning
  # ---------------------------------------------------------------------------
  # SNM enables rspamd by default. Here we tune thresholds and enable
  # Bayesian auto-learning: moving mail to/from Junk trains the classifier.
  services.rspamd.extraConfig = ''
    actions {
      reject = 15;      # Reject clear spam (rspamd default)
      add_header = 6;   # Add X-Spam headers for borderline messages
      greylist = 4;     # Greylist suspicious messages
    }
  '';

  # Teach rspamd to learn from Dovecot sieve moves (Junk ↔ Inbox).
  # The mailserver module already sets up the Junk folder and sieve;
  # we just make sure the spam/ham learn scripts are enabled.
  services.rspamd.locals."classifier-bayes.conf".text = ''
    autolearn = true;
    autolearn_spam_threshold = 6.0;
    autolearn_ham_threshold = -0.5;
  '';

  # Rspamd controller API requires a password for web UI actions/stats calls.
  services.rspamd.workers.controller.extraConfig = ''
    password = "${settings.imapPassword}";
    enable_password = "${settings.imapPassword}";
  '';

  # ---------------------------------------------------------------------------
  # Rspamd web UI — proxied through nginx at rspamd.<domain>
  # Protected by HTTP basic auth (htpasswd format).
  # Generate password hash: nix-shell -p apacheHttpd --run 'htpasswd -nbB admin YOUR_PASSWORD'
  # ---------------------------------------------------------------------------
  services.nginx.virtualHosts."rspamd.${settings.domain}" = {
    enableACME = true;
    forceSSL = true;
    basicAuth = {
      # Default password is the same as the mail account password.
      # Change this by overriding with a hashed value or a basicAuthFile.
      admin = settings.imapPassword;
    };
    locations."/" = {
      proxyPass = "http://unix:/run/rspamd/worker-controller.sock:/";
      extraConfig = ''
        proxy_set_header Password "${settings.imapPassword}";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
      '';
    };
  };

  # 1. Configure ACME (Let's Encrypt)
  security.acme = {
    acceptTerms = true;
    defaults.email = settings.email;
    defaults.server = acmeServer;
  };

  # 2. Configure Nginx to request the certificate
  services.nginx = {
    enable = true;
    virtualHosts."${settings.hostName}.${settings.domain}" = {
      enableACME = true;
      forceSSL = true;
    };
  };

  # 3. Grant Mail Services Access to Certificates
  systemd.services.postfix.serviceConfig.SupplementaryGroups = [ "nginx" ];
  systemd.services.dovecot.serviceConfig.SupplementaryGroups = [ "nginx" ];
}
