export const INITIAL_SCHEMA = `
  CREATE TABLE category (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    icon TEXT,
    color TEXT,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE recurring_rule (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
    category_id TEXT NOT NULL REFERENCES category(id),
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    next_due TEXT NOT NULL,
    remind_days_before INTEGER NOT NULL DEFAULT 0
      CHECK (typeof(remind_days_before) = 'integer' AND remind_days_before >= 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE receipt (
    id TEXT PRIMARY KEY NOT NULL,
    local_uri TEXT,
    storage_path TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
    extracted_json TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE "transaction" (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
    currency TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES category(id),
    merchant TEXT,
    note TEXT,
    occurred_at TEXT NOT NULL,
    receipt_id TEXT UNIQUE REFERENCES receipt(id),
    recurring_id TEXT REFERENCES recurring_rule(id),
    occurrence_index INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (
      (recurring_id IS NULL AND occurrence_index IS NULL)
      OR (recurring_id IS NOT NULL AND typeof(occurrence_index) = 'integer'
          AND occurrence_index >= 0)
    ),
    UNIQUE (recurring_id, occurrence_index)
  );

  CREATE TABLE budget (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT NOT NULL REFERENCES category(id),
    month TEXT NOT NULL CHECK (
      month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
      AND substr(month, 6, 2) BETWEEN '01' AND '12'
    ),
    limit_minor INTEGER NOT NULL CHECK (typeof(limit_minor) = 'integer' AND limit_minor > 0),
    alerted_80 INTEGER NOT NULL DEFAULT 0 CHECK (alerted_80 IN (0, 1)),
    alerted_100 INTEGER NOT NULL DEFAULT 0 CHECK (alerted_100 IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE (category_id, month)
  );

  CREATE TABLE outbox (
    id TEXT PRIMARY KEY NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
    payload TEXT,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (typeof(attempts) = 'integer' AND attempts >= 0),
    created_at TEXT NOT NULL
  );

  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX transaction_occurred_at ON "transaction" (occurred_at);
  CREATE INDEX transaction_category_occurred_at ON "transaction" (category_id, occurred_at);
  CREATE INDEX recurring_rule_next_due ON recurring_rule (next_due);

  WITH defaults(id, name, kind) AS (
    VALUES
      ('4765444e-b400-4ec3-9b6e-6ed0950edcd1', 'Comida', 'expense'),
      ('5dc9d1cc-e758-47a6-a6ce-c98605823a52', 'Transporte', 'expense'),
      ('fddd4535-7811-46dc-bc03-d0065a6af81d', 'Salario', 'income')
  )
  INSERT INTO category (id, name, kind, is_default, created_at, updated_at)
  SELECT id, name, kind, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM defaults;
`;
