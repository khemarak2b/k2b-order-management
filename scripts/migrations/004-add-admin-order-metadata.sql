ALTER TABLE dev.orders
  ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by_admin_id INTEGER REFERENCES dev.admin_users(id),
  ADD COLUMN IF NOT EXISTS pricing_profile_id UUID REFERENCES dev.pricing_profiles(id);

CREATE INDEX IF NOT EXISTS idx_dev_orders_created_by_admin
  ON dev.orders (created_by_admin);

CREATE INDEX IF NOT EXISTS idx_dev_orders_created_by_admin_id
  ON dev.orders (created_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_dev_orders_pricing_profile_id
  ON dev.orders (pricing_profile_id);

ALTER TABLE prod.orders
  ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by_admin_id INTEGER REFERENCES prod.admin_users(id),
  ADD COLUMN IF NOT EXISTS pricing_profile_id UUID REFERENCES prod.pricing_profiles(id);

CREATE INDEX IF NOT EXISTS idx_prod_orders_created_by_admin
  ON prod.orders (created_by_admin);

CREATE INDEX IF NOT EXISTS idx_prod_orders_created_by_admin_id
  ON prod.orders (created_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_prod_orders_pricing_profile_id
  ON prod.orders (pricing_profile_id);
