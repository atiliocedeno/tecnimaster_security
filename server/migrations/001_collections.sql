ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_day INTEGER NOT NULL DEFAULT 5;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS due_month_offset INTEGER NOT NULL DEFAULT 1;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS grace_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS suspension_day INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS suspension_month_offset INTEGER NOT NULL DEFAULT 1;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS legacy_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lifecycle TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS vehicles (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
 label TEXT NOT NULL, plate TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL CHECK(price>=0),
 tax_mode TEXT NOT NULL CHECK(tax_mode IN ('included','excluded','exempt')),
 status TEXT NOT NULL DEFAULT 'active', version INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_plate_unique ON vehicles(upper(plate)) WHERE plate<>'' AND status<>'removed';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_on TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS grace_until TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS suspension_on TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_net INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_iva INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS lines JSONB NOT NULL DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_channel TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivered_on TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS invoice_dedupe ON invoices(dedupe_key) WHERE dedupe_key IS NOT NULL AND NOT voided;

CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id),
 amount INTEGER NOT NULL CHECK(amount<>0), paid_on TEXT NOT NULL,
 reference TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
 reverses TEXT UNIQUE REFERENCES payments(id), actor TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_reference_unique ON payments(invoice_id,reference) WHERE reference<>'' AND reverses IS NULL;
CREATE TABLE IF NOT EXISTS customer_events (
 id TEXT PRIMARY KEY, client_id TEXT REFERENCES clients(id),
 type TEXT NOT NULL, event_date TEXT NOT NULL, reason TEXT NOT NULL,
 payload JSONB NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_event_client ON customer_events(client_id,created_at);
CREATE TABLE IF NOT EXISTS collection_settings (
 id TEXT PRIMARY KEY, renewal_amount INTEGER NOT NULL DEFAULT 20000,
 renewal_tax_mode TEXT NOT NULL DEFAULT 'unknown'
);
INSERT INTO collection_settings(id) VALUES('default') ON CONFLICT(id) DO NOTHING;

-- Existing financial values and PKs are deliberately not updated.
-- Restrict even stale clients/older API processes from deleting history.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS "invoices_clientId_fkey";
ALTER TABLE invoices ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION prevent_financial_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Use retiro o anulación auditada; no se permite borrar historia'; END;
$$;
DROP TRIGGER IF EXISTS protect_clients_delete ON clients;
CREATE TRIGGER protect_clients_delete BEFORE DELETE ON clients FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
DROP TRIGGER IF EXISTS protect_invoices_delete ON invoices;
CREATE TRIGGER protect_invoices_delete BEFORE DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
DROP TRIGGER IF EXISTS protect_payments_delete ON payments;
CREATE TRIGGER protect_payments_delete BEFORE DELETE OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
DROP TRIGGER IF EXISTS protect_events_delete ON customer_events;
CREATE TRIGGER protect_events_delete BEFORE DELETE OR UPDATE ON customer_events FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
