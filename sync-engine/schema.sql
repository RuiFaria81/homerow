-- =============================================================================
-- Email Sync Engine - PostgreSQL Schema
-- =============================================================================
-- Mirrors IMAP mailbox state into PostgreSQL for fast frontend reads.
-- Designed for a single-tenant webmail deployment on NixOS.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fast ILIKE/trigram search

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
-- Each row represents one IMAP/SMTP account the engine syncs.
CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(255),

    -- IMAP connection
    imap_host       VARCHAR(255) NOT NULL,
    imap_port       INTEGER      NOT NULL DEFAULT 993,
    imap_tls        BOOLEAN      NOT NULL DEFAULT true,

    -- SMTP connection
    smtp_host       VARCHAR(255) NOT NULL,
    smtp_port       INTEGER      NOT NULL DEFAULT 587,

    -- Credentials (app reads these; stored encrypted at the OS/secret-manager level)
    username        VARCHAR(255) NOT NULL,
    password        TEXT         NOT NULL,

    last_sync_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- folders (mailboxes)
-- ---------------------------------------------------------------------------
-- One row per IMAP mailbox. Tracks UIDVALIDITY so we can detect resets.
CREATE TABLE folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    path            VARCHAR(500) NOT NULL,           -- IMAP path, e.g. "INBOX"
    name            VARCHAR(255) NOT NULL,           -- Human-readable name
    delimiter       VARCHAR(10),                     -- Hierarchy delimiter
    flags           JSONB        NOT NULL DEFAULT '[]',
    special_use     VARCHAR(50),                     -- \Inbox, \Sent, \Drafts, \Trash, \Archive, \Junk

    -- IMAP sync cursors
    uid_validity    BIGINT,
    uid_next        BIGINT,                          -- For incremental sync
    highest_mod_seq BIGINT,                          -- CONDSTORE / QRESYNC

    total_messages  INTEGER      NOT NULL DEFAULT 0,
    unread_count    INTEGER      NOT NULL DEFAULT 0,

    -- Sync bookkeeping
    sync_state      VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (sync_state IN ('pending','syncing','synced','error','stale')),
    last_sync_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    UNIQUE (account_id, path)
);

CREATE INDEX idx_folders_account ON folders (account_id);

-- ---------------------------------------------------------------------------
-- threads
-- ---------------------------------------------------------------------------
-- Groups related messages into conversations using References / In-Reply-To.
CREATE TABLE threads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    subject         TEXT,                             -- Normalized (stripped Re:/Fwd:)
    snippet         TEXT,                             -- Preview of latest message
    last_message_at TIMESTAMPTZ,
    message_count   INTEGER      NOT NULL DEFAULT 0,
    unread_count    INTEGER      NOT NULL DEFAULT 0,
    has_attachments BOOLEAN      NOT NULL DEFAULT false,
    participants    JSONB        NOT NULL DEFAULT '[]',
    folder_ids      UUID[]       NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_account     ON threads (account_id);
CREATE INDEX idx_threads_last_msg    ON threads (account_id, last_message_at DESC);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
-- One row per email. Stores parsed content (sanitized HTML + plain text).
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id       UUID         NOT NULL REFERENCES folders(id)  ON DELETE CASCADE,
    thread_id       UUID                  REFERENCES threads(id)  ON DELETE SET NULL,

    -- IMAP identifiers
    uid             BIGINT       NOT NULL,            -- IMAP UID within this folder
    message_id      VARCHAR(998),                     -- RFC 5322 Message-ID
    in_reply_to     VARCHAR(998),
    "references"    TEXT[],                           -- For threading

    -- Envelope
    subject         TEXT,
    from_address    JSONB        NOT NULL DEFAULT '{}',  -- {"name":"…","address":"…"}
    to_addresses    JSONB        NOT NULL DEFAULT '[]',
    cc_addresses    JSONB        NOT NULL DEFAULT '[]',
    bcc_addresses   JSONB        NOT NULL DEFAULT '[]',
    reply_to        JSONB        NOT NULL DEFAULT '[]',
    date            TIMESTAMPTZ,

    -- Flags & labels
    flags           TEXT[]       NOT NULL DEFAULT '{}',
    labels          TEXT[]       NOT NULL DEFAULT '{}',

    -- Body (parsed & sanitized)
    text_body       TEXT,                             -- Plain text (search + snippet)
    html_body       TEXT,                             -- Sanitized HTML for display
    snippet         TEXT,                             -- First ~200 chars

    -- Spam filtering
    spam_score      REAL,                             -- Rspamd score (null = not scored)

    -- Metadata
    size_bytes      INTEGER,
    headers         JSONB        NOT NULL DEFAULT '{}',
    has_attachments BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    UNIQUE (folder_id, uid)
);

CREATE INDEX idx_messages_account    ON messages (account_id);
CREATE INDEX idx_messages_folder     ON messages (folder_id);
CREATE INDEX idx_messages_folder_date_uid ON messages (folder_id, date DESC, uid DESC);
CREATE INDEX idx_messages_thread     ON messages (thread_id);
CREATE INDEX idx_messages_date       ON messages (account_id, date DESC);
CREATE INDEX idx_messages_message_id ON messages (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_messages_flags      ON messages USING GIN (flags);
CREATE INDEX idx_messages_size       ON messages (account_id, size_bytes);
CREATE INDEX idx_messages_attach_date ON messages (account_id, has_attachments, date DESC);
CREATE INDEX idx_messages_from_email_lower ON messages (lower(from_address->>'address'));
CREATE INDEX idx_messages_subject_trgm ON messages USING GIN (subject gin_trgm_ops);
CREATE INDEX idx_messages_to_trgm ON messages USING GIN ((coalesce(to_addresses::text, '')) gin_trgm_ops);
CREATE INDEX idx_messages_cc_trgm ON messages USING GIN ((coalesce(cc_addresses::text, '')) gin_trgm_ops);

-- Full-text search on subject + text body
CREATE INDEX idx_messages_fts ON messages
    USING GIN (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(text_body,'')));

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------
-- Metadata only. Large blobs are stored on disk at `storage_path`.
CREATE TABLE attachments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          UUID         NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename            VARCHAR(500),
    content_type        VARCHAR(255),
    size_bytes          INTEGER,
    content_id          VARCHAR(500),   -- CID for inline images
    content_disposition VARCHAR(50),    -- "attachment" | "inline"
    storage_path        TEXT,           -- On-disk path for the blob
    checksum            VARCHAR(128),   -- SHA-256 for dedup

    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_message ON attachments (message_id);

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
-- Auto-populated from sent/received email addresses.
CREATE TABLE contacts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id        UUID         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email             VARCHAR(255) NOT NULL,
    display_name      VARCHAR(255),
    frequency         INTEGER      NOT NULL DEFAULT 1,
    last_contacted_at TIMESTAMPTZ,
    source            VARCHAR(50)  NOT NULL DEFAULT 'sent'
                      CHECK (source IN ('sent','received','manual')),

    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

    UNIQUE (account_id, email)
);

CREATE INDEX idx_contacts_account ON contacts (account_id);

-- ---------------------------------------------------------------------------
-- sync_log
-- ---------------------------------------------------------------------------
-- Audit trail for debugging sync issues.
CREATE TABLE sync_log (
    id          BIGSERIAL PRIMARY KEY,
    account_id  UUID         REFERENCES accounts(id)  ON DELETE CASCADE,
    folder_id   UUID         REFERENCES folders(id)   ON DELETE SET NULL,
    event_type  VARCHAR(50)  NOT NULL,
    details     JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_account ON sync_log (account_id, created_at DESC);
CREATE INDEX idx_sync_log_type    ON sync_log (event_type);

-- ---------------------------------------------------------------------------
-- automation rule settings + rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rule_settings (
    account_email                    TEXT        PRIMARY KEY,
    label_stop_after_first_match     BOOLEAN     NOT NULL DEFAULT false,
    label_auto_create_from_template  BOOLEAN     NOT NULL DEFAULT true,
    webhook_stop_after_first_match   BOOLEAN     NOT NULL DEFAULT false,
    updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_label_rules (
    id               TEXT        PRIMARY KEY,
    account_email    TEXT        NOT NULL,
    enabled          BOOLEAN     NOT NULL DEFAULT true,
    priority         INTEGER     NOT NULL DEFAULT 1,
    target_field     TEXT        NOT NULL,
    match_type       TEXT        NOT NULL,
    pattern          TEXT        NOT NULL DEFAULT '',
    case_sensitive   BOOLEAN     NOT NULL DEFAULT false,
    label_mode       TEXT        NOT NULL,
    label_name       TEXT        NOT NULL DEFAULT '',
    label_template   TEXT        NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_label_rules_account_priority
  ON automation_label_rules (account_email, priority, created_at);

CREATE TABLE IF NOT EXISTS automation_webhook_rules (
    id               TEXT        PRIMARY KEY,
    account_email    TEXT        NOT NULL,
    enabled          BOOLEAN     NOT NULL DEFAULT true,
    priority         INTEGER     NOT NULL DEFAULT 1,
    target_field     TEXT        NOT NULL,
    match_type       TEXT        NOT NULL,
    pattern          TEXT        NOT NULL DEFAULT '',
    case_sensitive   BOOLEAN     NOT NULL DEFAULT false,
    endpoint_url     TEXT        NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_webhook_rules_account_priority
  ON automation_webhook_rules (account_email, priority, created_at);

CREATE TABLE IF NOT EXISTS webhook_delivery_history (
    id                    BIGSERIAL   PRIMARY KEY,
    account_email         TEXT        NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    endpoint_url          TEXT        NOT NULL,
    status                TEXT        NOT NULL,
    http_status           INTEGER,
    error_message         TEXT,
    response_preview      TEXT,
    request_body_preview  TEXT        NOT NULL,
    folder                TEXT        NOT NULL DEFAULT '',
    rule_id               TEXT        NOT NULL DEFAULT '',
    rule_priority         INTEGER     NOT NULL DEFAULT 0,
    target_field          TEXT        NOT NULL DEFAULT '',
    match_type            TEXT        NOT NULL DEFAULT '',
    matched_value         TEXT        NOT NULL DEFAULT '',
    email_subject         TEXT        NOT NULL DEFAULT '',
    email_from_address    TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_history_account_created
  ON webhook_delivery_history (account_email, created_at DESC);

COMMIT;
