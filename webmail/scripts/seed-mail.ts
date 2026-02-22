import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USER_EMAIL = 'admin@local'; 
const USER_PASS = 'password';

const SMTP_PORT = 3025;
const IMAP_PORT = 3143;
const HOST = '127.0.0.1';

const SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed');

const ARGS_COUNT = parseInt(process.argv[2]);
const BULK_COUNT = isNaN(ARGS_COUNT) ? 0 : ARGS_COUNT;

const transporter = nodemailer.createTransport({
  host: HOST,
  port: SMTP_PORT,
  secure: false,
  tls: { rejectUnauthorized: false },
  auth: { user: USER_EMAIL, pass: USER_PASS }
});

const imapClient = new ImapFlow({
  host: HOST,
  port: IMAP_PORT,
  secure: false,
  auth: { user: USER_EMAIL, pass: USER_PASS },
  tls: { rejectUnauthorized: false },
  logger: false
});

const dummyPDF = Buffer.from('%PDF-1.7\n...', 'binary');
const emails = [
  {
    from: '"GitHub" <noreply@github.com>',
    subject: "[solidjs/solid-start] Release v1.0.0 is out! 🎉",
    html: `<h2>Release v1.0.0</h2><p>SolidStart 1.0 is here.</p>`,
    action: 'star'
  },
  {
    from: '"Amazon" <orders@amazon-fake.com>',
    subject: "Delivered: Your package waiting for you",
    html: `<h2>Arrived!</h2><p>Package on front porch.</p>`,
    action: 'read'
  },
  {
    from: '"HR" <hr@corp.local>',
    subject: "Important: Q4 Payroll Summary",
    html: `<p>Please review attached PDF.</p>`,
    attachments: [{ filename: 'Payroll.pdf', content: dummyPDF }]
  }
];

// =============================================================================
// CONVERSATION THREAD SEEDS
// =============================================================================
// Each conversation is an array of messages with proper Message-ID, In-Reply-To,
// and References headers so the sync engine threading algorithm groups them.

interface ConversationMessage {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  flags?: string[];
}

const now = Date.now();
const HOUR = 3600000;
const DAY = 86400000;

const conversations: ConversationMessage[][] = [
  // --- Conversation 1: Team standup discussion (4 messages) ---
  [
    {
      messageId: '<standup-001@corp.local>',
      from: '"Alice Chen" <alice@corp.local>',
      to: USER_EMAIL,
      subject: 'Daily standup - Sprint 24 updates',
      body: `<p>Hi team,</p>
<p>Here are my updates for today:</p>
<ul>
  <li><b>Yesterday:</b> Finished the user authentication module and wrote unit tests.</li>
  <li><b>Today:</b> Starting on the API rate limiting feature.</li>
  <li><b>Blockers:</b> None right now.</li>
</ul>
<p>Please share your updates when you get a chance.</p>
<p>Thanks,<br>Alice</p>`,
      date: new Date(now - 3 * DAY - 2 * HOUR),
    },
    {
      messageId: '<standup-002@corp.local>',
      inReplyTo: '<standup-001@corp.local>',
      references: ['<standup-001@corp.local>'],
      from: '"Bob Martinez" <bob@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: Daily standup - Sprint 24 updates',
      body: `<p>Thanks Alice!</p>
<p>My updates:</p>
<ul>
  <li><b>Yesterday:</b> Fixed the pagination bug in the dashboard (#1234).</li>
  <li><b>Today:</b> Working on the export CSV feature.</li>
  <li><b>Blockers:</b> Waiting on design specs for the new report layout.</li>
</ul>
<p>Bob</p>`,
      date: new Date(now - 3 * DAY - 1 * HOUR),
    },
    {
      messageId: '<standup-003@corp.local>',
      inReplyTo: '<standup-001@corp.local>',
      references: ['<standup-001@corp.local>', '<standup-002@corp.local>'],
      from: `"Me" <${USER_EMAIL}>`,
      to: 'alice@corp.local',
      subject: 'Re: Daily standup - Sprint 24 updates',
      body: `<p>Great progress everyone!</p>
<p>My updates:</p>
<ul>
  <li><b>Yesterday:</b> Reviewed PRs and merged the notification system.</li>
  <li><b>Today:</b> Setting up the email threading feature for the webmail client.</li>
  <li><b>Blockers:</b> None.</li>
</ul>
<p>@Bob - I'll ping the design team about those specs.</p>`,
      date: new Date(now - 3 * DAY),
      flags: ['\\Seen'],
    },
    {
      messageId: '<standup-004@corp.local>',
      inReplyTo: '<standup-003@corp.local>',
      references: ['<standup-001@corp.local>', '<standup-002@corp.local>', '<standup-003@corp.local>'],
      from: '"Alice Chen" <alice@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: Daily standup - Sprint 24 updates',
      body: `<p>Thanks for the update! The email threading feature sounds interesting.</p>
<p>Let me know if you need any help with the backend queries - I worked on something similar at my previous job.</p>
<p>Alice</p>`,
      date: new Date(now - 2 * DAY - 20 * HOUR),
    },
  ],

  // --- Conversation 2: Project deployment discussion (5 messages) ---
  [
    {
      messageId: '<deploy-001@corp.local>',
      from: '"DevOps" <devops@corp.local>',
      to: USER_EMAIL,
      subject: 'Production deployment scheduled for Friday',
      body: `<p>Hi all,</p>
<p>We have a production deployment scheduled for <b>Friday at 10:00 PM UTC</b>.</p>
<p>Changes included:</p>
<ol>
  <li>New user dashboard (v2.3.0)</li>
  <li>Performance optimizations for search</li>
  <li>Security patch for session handling</li>
</ol>
<p>Please make sure all PRs are merged by Thursday EOD.</p>
<p>- DevOps Team</p>`,
      date: new Date(now - 2 * DAY),
    },
    {
      messageId: '<deploy-002@corp.local>',
      inReplyTo: '<deploy-001@corp.local>',
      references: ['<deploy-001@corp.local>'],
      from: '"Sarah Kim" <sarah@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: Production deployment scheduled for Friday',
      body: `<p>Thanks for the heads up. I have two PRs still in review:</p>
<ul>
  <li>#892 - Dashboard widget refactor</li>
  <li>#895 - Fix timezone display in reports</li>
</ul>
<p>Can someone review these today?</p>`,
      date: new Date(now - 2 * DAY + 2 * HOUR),
    },
    {
      messageId: '<deploy-003@corp.local>',
      inReplyTo: '<deploy-002@corp.local>',
      references: ['<deploy-001@corp.local>', '<deploy-002@corp.local>'],
      from: `"Me" <${USER_EMAIL}>`,
      to: 'sarah@corp.local',
      subject: 'Re: Production deployment scheduled for Friday',
      body: `<p>I can review #892 this afternoon. Assigning it to myself now.</p>`,
      date: new Date(now - 2 * DAY + 4 * HOUR),
      flags: ['\\Seen'],
    },
    {
      messageId: '<deploy-004@corp.local>',
      inReplyTo: '<deploy-003@corp.local>',
      references: ['<deploy-001@corp.local>', '<deploy-002@corp.local>', '<deploy-003@corp.local>'],
      from: '"Sarah Kim" <sarah@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: Production deployment scheduled for Friday',
      body: `<p>Awesome, thank you! I'll address any feedback right away.</p>`,
      date: new Date(now - 2 * DAY + 5 * HOUR),
    },
    {
      messageId: '<deploy-005@corp.local>',
      inReplyTo: '<deploy-004@corp.local>',
      references: ['<deploy-001@corp.local>', '<deploy-002@corp.local>', '<deploy-003@corp.local>', '<deploy-004@corp.local>'],
      from: '"DevOps" <devops@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: Production deployment scheduled for Friday',
      body: `<p>Update: Both PRs have been merged. Deployment is still on track for Friday 10 PM UTC.</p>
<p>Monitoring dashboards will be shared before the deployment window.</p>
<p>- DevOps Team</p>`,
      date: new Date(now - 1 * DAY - 10 * HOUR),
    },
  ],

  // --- Conversation 3: Quick back-and-forth about lunch (3 messages) ---
  [
    {
      messageId: '<lunch-001@corp.local>',
      from: '"Carlos Ruiz" <carlos@corp.local>',
      to: USER_EMAIL,
      subject: 'Lunch today?',
      body: `<p>Hey! Want to grab lunch at the new ramen place downtown? Heard it's really good.</p>`,
      date: new Date(now - 6 * HOUR),
    },
    {
      messageId: '<lunch-002@corp.local>',
      inReplyTo: '<lunch-001@corp.local>',
      references: ['<lunch-001@corp.local>'],
      from: `"Me" <${USER_EMAIL}>`,
      to: 'carlos@corp.local',
      subject: 'Re: Lunch today?',
      body: `<p>Sounds great! What time works for you? I'm free after 12:30.</p>`,
      date: new Date(now - 5 * HOUR),
      flags: ['\\Seen'],
    },
    {
      messageId: '<lunch-003@corp.local>',
      inReplyTo: '<lunch-002@corp.local>',
      references: ['<lunch-001@corp.local>', '<lunch-002@corp.local>'],
      from: '"Carlos Ruiz" <carlos@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: Lunch today?',
      body: `<p>12:30 works perfectly. I'll book a table. Meet at the lobby?</p>`,
      date: new Date(now - 4 * HOUR),
    },
  ],

  // --- Conversation 4: Bug report thread (6 messages) ---
  [
    {
      messageId: '<bug-001@corp.local>',
      from: '"QA Team" <qa@corp.local>',
      to: USER_EMAIL,
      subject: '[BUG] Search results not loading on mobile Safari',
      body: `<p><b>Bug Report #2847</b></p>
<p><b>Environment:</b> iOS 17.2, Safari</p>
<p><b>Steps to reproduce:</b></p>
<ol>
  <li>Open the app on iPhone</li>
  <li>Tap the search bar</li>
  <li>Type any query and hit enter</li>
  <li>Results spinner shows indefinitely</li>
</ol>
<p><b>Expected:</b> Search results should load within 2 seconds.</p>
<p><b>Severity:</b> High - affects all mobile Safari users.</p>`,
      date: new Date(now - 5 * DAY),
    },
    {
      messageId: '<bug-002@corp.local>',
      inReplyTo: '<bug-001@corp.local>',
      references: ['<bug-001@corp.local>'],
      from: `"Me" <${USER_EMAIL}>`,
      to: 'qa@corp.local',
      subject: 'Re: [BUG] Search results not loading on mobile Safari',
      body: `<p>Thanks for the detailed report. I can reproduce this on my device too.</p>
<p>Looking at the network tab, the API call succeeds but the response parsing fails. I think it's related to the AbortController polyfill we're using.</p>
<p>Investigating now.</p>`,
      date: new Date(now - 5 * DAY + 3 * HOUR),
      flags: ['\\Seen'],
    },
    {
      messageId: '<bug-003@corp.local>',
      inReplyTo: '<bug-002@corp.local>',
      references: ['<bug-001@corp.local>', '<bug-002@corp.local>'],
      from: '"Alice Chen" <alice@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: [BUG] Search results not loading on mobile Safari',
      body: `<p>I ran into something similar last month with the file upload feature. The issue was that Safari doesn't support <code>ReadableStream</code> in the same way Chrome does.</p>
<p>We ended up using a response.text() fallback instead of response.json() with streaming.</p>
<p>Check <code>src/lib/api-client.ts</code> line 142.</p>`,
      date: new Date(now - 5 * DAY + 5 * HOUR),
    },
    {
      messageId: '<bug-004@corp.local>',
      inReplyTo: '<bug-003@corp.local>',
      references: ['<bug-001@corp.local>', '<bug-002@corp.local>', '<bug-003@corp.local>'],
      from: `"Me" <${USER_EMAIL}>`,
      to: 'alice@corp.local',
      subject: 'Re: [BUG] Search results not loading on mobile Safari',
      body: `<p>Good catch Alice! That was exactly it. I've pushed a fix in PR #2851.</p>
<p>The fix adds a Safari detection check and falls back to non-streaming response parsing.</p>`,
      date: new Date(now - 4 * DAY - 18 * HOUR),
      flags: ['\\Seen'],
    },
    {
      messageId: '<bug-005@corp.local>',
      inReplyTo: '<bug-004@corp.local>',
      references: ['<bug-001@corp.local>', '<bug-002@corp.local>', '<bug-003@corp.local>', '<bug-004@corp.local>'],
      from: '"QA Team" <qa@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: [BUG] Search results not loading on mobile Safari',
      body: `<p>Verified the fix on staging. Search works correctly on Safari now.</p>
<p>Marking #2847 as resolved. Thanks for the quick turnaround!</p>`,
      date: new Date(now - 4 * DAY - 12 * HOUR),
    },
    {
      messageId: '<bug-006@corp.local>',
      inReplyTo: '<bug-005@corp.local>',
      references: ['<bug-001@corp.local>', '<bug-002@corp.local>', '<bug-003@corp.local>', '<bug-004@corp.local>', '<bug-005@corp.local>'],
      from: '"Bob Martinez" <bob@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: [BUG] Search results not loading on mobile Safari',
      body: `<p>Nice fix! We should probably add this to our browser compatibility checklist for future features.</p>
<p>I'll create a wiki page documenting Safari-specific gotchas.</p>`,
      date: new Date(now - 4 * DAY - 8 * HOUR),
    },
  ],

  // --- Conversation 5: Conference planning (3 messages, unread) ---
  [
    {
      messageId: '<conf-001@corp.local>',
      from: '"Events" <events@corp.local>',
      to: USER_EMAIL,
      subject: 'NixCon 2026 - Speaker submission deadline extended',
      body: `<p>Hi,</p>
<p>Great news! The CFP deadline for <b>NixCon 2026</b> has been extended to <b>March 15th</b>.</p>
<p>We'd love to see a talk from your team about the NixOS mail server deployment stack you've been building.</p>
<p>Submission portal: nixcon2026.org/cfp</p>`,
      date: new Date(now - 1 * DAY),
    },
    {
      messageId: '<conf-002@corp.local>',
      inReplyTo: '<conf-001@corp.local>',
      references: ['<conf-001@corp.local>'],
      from: '"Alice Chen" <alice@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: NixCon 2026 - Speaker submission deadline extended',
      body: `<p>This would be a great opportunity! We could talk about how we use Nix flakes to manage the full mail stack (Postfix + Dovecot + webmail).</p>
<p>Want to co-present? I can handle the infrastructure side and you cover the webmail app.</p>`,
      date: new Date(now - 12 * HOUR),
    },
    {
      messageId: '<conf-003@corp.local>',
      inReplyTo: '<conf-002@corp.local>',
      references: ['<conf-001@corp.local>', '<conf-002@corp.local>'],
      from: '"Bob Martinez" <bob@corp.local>',
      to: USER_EMAIL,
      subject: 'Re: NixCon 2026 - Speaker submission deadline extended',
      body: `<p>Count me in too! I can demo the IMAP sync engine and the threading algorithm we built.</p>
<p>Let's set up a meeting this week to outline the talk structure.</p>`,
      date: new Date(now - 4 * HOUR),
    },
  ],
];

/**
 * Build an RFC 5322 raw message from a ConversationMessage.
 * Includes proper Message-ID, In-Reply-To, and References headers
 * so the sync engine's threading algorithm can group them.
 */
function buildRawMessage(msg: ConversationMessage): string {
  const headers = [
    `From: ${msg.from}`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    `Date: ${msg.date.toUTCString()}`,
    `Message-ID: ${msg.messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
  ];

  if (msg.inReplyTo) {
    headers.push(`In-Reply-To: ${msg.inReplyTo}`);
  }
  if (msg.references && msg.references.length > 0) {
    headers.push(`References: ${msg.references.join(' ')}`);
  }

  return headers.join('\r\n') + '\r\n\r\n' + msg.body;
}

async function main() {
  console.log(`🌱 Seeding for user: ${USER_EMAIL}`);

  if (BULK_COUNT > 0) {
    console.log(`ℹ️  Bulk mode active: targeting +${BULK_COUNT} extra emails`);
  }

  console.log("📨 [Phase 1] Sending fake scenarios via SMTP...");
  for (const email of emails) {
    await transporter.sendMail({
      from: email.from,
      to: USER_EMAIL,
      subject: email.subject,
      html: email.html,
      attachments: email.attachments,
    });
    process.stdout.write('.'); 
    await new Promise(r => setTimeout(r, 200)); 
  }
  console.log("\n   Done.");

  console.log("🗄️  [Phase 2] Connecting to IMAP...");
  await imapClient.connect();
  const lock = await imapClient.getMailboxLock('INBOX');

  try {
    console.log("📂 [Phase 3] Injecting real .eml files...");
    try {
      const files = await fs.readdir(SEED_DIR);
      const emlFiles = files.filter(f => f.endsWith('.eml'));
      
      if (emlFiles.length === 0) console.log("   No .eml files found in seed/ folder.");
      
      for (const file of emlFiles) {
        const content = await fs.readFile(path.join(SEED_DIR, file));
        await imapClient.append('INBOX', content, []); 
        console.log(`   📄 Injected: ${file}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Skipped file injection: ${e.message}`);
    }

    console.log("💬 [Phase 3.5] Injecting conversation threads...");
    for (let ci = 0; ci < conversations.length; ci++) {
      const thread = conversations[ci];
      const subject = thread[0].subject;
      console.log(`   🧵 Thread ${ci + 1}/${conversations.length}: "${subject}" (${thread.length} messages)`);

      for (const msg of thread) {
        const raw = buildRawMessage(msg);
        const flags = msg.flags || [];
        await imapClient.append('INBOX', raw, flags);
        await new Promise(r => setTimeout(r, 100));
      }
    }
    const totalConvMsgs = conversations.reduce((sum, t) => sum + t.length, 0);
    console.log(`   Done. Injected ${totalConvMsgs} messages across ${conversations.length} conversations.`);

    if (BULK_COUNT > 0) {
      console.log(`📦 [Phase 4] Bulk generating ${BULK_COUNT} messages...`);
      const startTime = Date.now();
      
      for (let i = 1; i <= BULK_COUNT; i++) {
        const date = new Date(Date.now() - Math.floor(Math.random() * 10000000000)); 
        const rfc822 = [
          `From: "Load Tester" <bot@loadtest.local>`,
          `To: <${USER_EMAIL}>`,
          `Subject: Load Test Message #${i} [${Math.random().toString(36).substring(7)}]`,
          `Date: ${date.toUTCString()}`,
          `Content-Type: text/plain; charset=utf-8`,
          `Message-ID: <${Date.now()}.${i}@loadtest.local>`,
          ``,
          `This is a generated message number ${i} for load testing purposes.`,
          `Generated at: ${new Date().toISOString()}`
        ].join('\r\n');

        await imapClient.append('INBOX', rfc822, i % 2 === 0 ? ['\\Seen'] : []);
        
        if (i % 500 === 0 || i === BULK_COUNT) {
          process.stdout.write(`\r   ⏳ Inserted ${i}/${BULK_COUNT} messages...`);
        }
      }
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n   ✅ Bulk insert complete in ${duration}s`);
    }

    console.log("✨ [Phase 5] Updating flags (Read/Star)...");
    for (const email of emails) {
      if (!email.action) continue;
      
      const searchResult = await imapClient.search({ subject: email.subject });
      if (searchResult.length > 0) {
        const seq = searchResult[searchResult.length - 1];
        
        if (email.action === 'read') {
          await imapClient.messageFlagsAdd(seq, ['\\Seen']);
        }
        if (email.action === 'star') {
          await imapClient.messageFlagsAdd(seq, ['\\Flagged']); 
        }
      }
    }
    
    const status = await imapClient.status('INBOX', { messages: true });
    console.log(`\n✅ COMPLETION: User ${USER_EMAIL} has ${status.messages} messages in INBOX.`);

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    lock.release();
    await imapClient.logout();
  }
}

main().catch(console.error);
