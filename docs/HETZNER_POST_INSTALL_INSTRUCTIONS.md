# Hetzner Post-Install Instructions

If you deploy this project on Hetzner Cloud, you may hit two common issues before outbound mail is fully reliable:

1. outbound SMTP ports `25` and `465` are blocked by default;
2. a fresh cloud IP can inherit poor sender reputation from a previous tenant.

This guide is the project-specific playbook to get from first deploy to stable deliverability.

## 1. Understand Hetzner SMTP Port Policy

Hetzner blocks outbound traffic on ports `25` and `465` by default for cloud servers.

In practice, this means your first SMTP attempts from `mail.<domain>` can time out even when deploy was successful.

Before requesting an unblock, verify Hetzner's current eligibility and process in their official FAQ:
- [Why can I only send mails to specific destinations?](https://docs.hetzner.com/cloud/servers/faq/#why-can-i-only-send-mails-to-specific-destinations)
- [How do I remove the email traffic block on port 25?](https://docs.hetzner.com/cloud/servers/faq/#how-do-i-remove-the-email-traffic-block-on-port-25)

At the time of writing, Hetzner commonly requires:
- account older than 1 month,
- first invoice paid,
- limit request with clear anti-spam posture.

## 2. Request Port Unblock (25/465)

After your account is eligible:

1. Open Hetzner Cloud Console.
2. Go to `Limits` -> `Request change` -> `Limit increase` (or create a support limit request).
3. Use a clear subject such as `Unblock Ports 25/465 for Mail Server`.
4. Include objective details (domain, host, use case, DNS protections).

Template:

```text
Hello Hetzner Team,

I run a self-hosted mail stack for transactional and personal mailbox traffic on:
- domain: <your-domain>
- mail host: mail.<your-domain>

I have configured SPF, DKIM, and DMARC, and set reverse DNS for the mail host.
Please unblock outbound traffic on ports 25 and 465 for this server.

Thank you.
```

## 3. Validate with Mail-Tester

Use [Mail-Tester](https://www.mail-tester.com/) as a baseline external score.

1. Open the site and copy the temporary address shown.
2. Log in to your web interface (`https://<WEBMAIL_SUBDOMAIN>.<domain>`) using the same credentials you set in `config.env`:
   - `EMAIL`
   - `MAIL_PASSWORD`
3. Compose and send an email from that account to the Mail-Tester address.
4. Use a non-empty subject/body with realistic content.
5. Click `Check your score`.

Do not send blank or synthetic-only bodies ("test", "hello"), because that can lower score independent of configuration quality.

## 4. If You Get 9.5/10 Due to Barracuda

A common outcome on recycled cloud IPs is a near-perfect score with a blocklist hit.

If Mail-Tester reports Barracuda listing:

1. Open [Barracuda removal request](https://www.barracudacentral.org/rbl/removal-request).
2. Submit your server IP and contact info.
3. Explain this is a newly rented IP with clean configuration and enforced DNS auth.

Template:

```text
I recently rented this IP from Hetzner for a new mail server.
This is a fresh installation with SPF, DKIM, and DMARC configured.
Please review and delist this IP from your reputation list.
```

## 5. Post-Unblock Smoke Test

After Hetzner approves and blocklist status is clean:

1. Send to a Gmail address and an Outlook address.
2. Verify:
   - accepted by remote server (no SMTP timeout/deferred loop),
   - not landing in spam for normal content,
   - SPF/DKIM/DMARC pass in message headers.
3. Re-run Mail-Tester after each major DNS or server config change.

## Notes

- Treat Hetzner and Barracuda policy pages as source of truth; both can change.
- If your score is still low after DNS/auth is correct, warm up sending volume gradually instead of high-volume bursts on day one.
