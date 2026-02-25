# Hetzner Post-Install Instructions

This guide is Hetzner-specific and focuses on SMTP port unblock policy.

For provider-agnostic deliverability validation (Mail-Tester workflow, blocklists, Barracuda template, inbox smoke tests), see:

- docs site: `/guides/post-install-deliverability/`
- source: `docs/src/content/docs/guides/post-install-deliverability.mdx`

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

I have configured the recommended email DNS records and set reverse DNS for the mail host.
Please unblock outbound traffic on ports 25 and 465 for this server.

Thank you.
```

## Notes

- Treat Hetzner policy pages as source of truth; limits and process can change.
- Complete provider-agnostic deliverability checks after the port unblock is approved.
