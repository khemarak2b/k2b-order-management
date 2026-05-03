-- Migration: add generic admin change log for order/invoice/admin edits

CREATE TABLE dev.admin_change_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  parent_entity_type VARCHAR(50) NOT NULL,
  parent_entity_id INTEGER NOT NULL,
  change_type VARCHAR(100) NOT NULL,
  field_name VARCHAR(100),
  before_value JSONB,
  after_value JSONB,
  reason_code VARCHAR(100) NOT NULL,
  reason_label VARCHAR(255) NOT NULL,
  admin_note TEXT,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dev_admin_change_log_parent
  ON dev.admin_change_log (parent_entity_type, parent_entity_id, changed_at DESC);
CREATE INDEX idx_dev_admin_change_log_entity
  ON dev.admin_change_log (entity_type, entity_id, changed_at DESC);
CREATE INDEX idx_dev_admin_change_log_change_type
  ON dev.admin_change_log (change_type, changed_at DESC);

CREATE TABLE prod.admin_change_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  parent_entity_type VARCHAR(50) NOT NULL,
  parent_entity_id INTEGER NOT NULL,
  change_type VARCHAR(100) NOT NULL,
  field_name VARCHAR(100),
  before_value JSONB,
  after_value JSONB,
  reason_code VARCHAR(100) NOT NULL,
  reason_label VARCHAR(255) NOT NULL,
  admin_note TEXT,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prod_admin_change_log_parent
  ON prod.admin_change_log (parent_entity_type, parent_entity_id, changed_at DESC);
CREATE INDEX idx_prod_admin_change_log_entity
  ON prod.admin_change_log (entity_type, entity_id, changed_at DESC);
CREATE INDEX idx_prod_admin_change_log_change_type
  ON prod.admin_change_log (change_type, changed_at DESC);
