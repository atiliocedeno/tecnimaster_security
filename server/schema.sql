CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, cars TEXT NOT NULL, notes TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY,"clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,period TEXT NOT NULL,due TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>=0),paid INTEGER NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=amount),review INTEGER NOT NULL DEFAULT 0,"sourceStatus" TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS invoices_client ON invoices("clientId");
CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS login_limits(id TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS whatsapp_test_reminders (
 invoice_id TEXT PRIMARY KEY REFERENCES invoices(id),
 correlation TEXT UNIQUE NOT NULL,
 wamid TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'pending',
 progress INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE whatsapp_test_reminders ADD COLUMN IF NOT EXISTS meta_error JSONB;

ALTER TABLE whatsapp_test_reminders ADD COLUMN IF NOT EXISTS recipient TEXT;
ALTER TABLE whatsapp_test_reminders ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE whatsapp_test_reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS whatsapp_inbound(
 wamid TEXT PRIMARY KEY, phone TEXT NOT NULL, body TEXT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL, reply_to TEXT, handled BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_thread ON whatsapp_inbound(phone,received_at);

ALTER TABLE whatsapp_inbound ADD COLUMN IF NOT EXISTS notification_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE whatsapp_test_reminders ADD COLUMN IF NOT EXISTS quota_month DATE;
CREATE INDEX IF NOT EXISTS whatsapp_reminder_month ON whatsapp_test_reminders(quota_month) WHERE quota_month IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_failed_attempts (
 correlation TEXT PRIMARY KEY,
 invoice_id TEXT NOT NULL,
 wamid TEXT,
 quota_month DATE,
 body TEXT,
 sent_at TIMESTAMPTZ,
 meta_error JSONB
);
