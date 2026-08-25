-- Migration: Create order_item_fulfillments table
-- Records which Shopify location(s) fulfilled each order item, and how much
-- quantity was shipped from each, so a single line item can be split across
-- multiple warehouses when an admin fulfills an order.

CREATE TABLE
  dev.order_item_fulfillments (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL REFERENCES dev.order_items (id) ON DELETE CASCADE,
    shopify_location_id TEXT NOT NULL,
    location_name TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
  );

CREATE INDEX idx_dev_order_item_fulfillments_order_item_id ON dev.order_item_fulfillments (order_item_id);

CREATE TABLE
  prod.order_item_fulfillments (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL REFERENCES prod.order_items (id) ON DELETE CASCADE,
    shopify_location_id TEXT NOT NULL,
    location_name TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
  );

CREATE INDEX idx_prod_order_item_fulfillments_order_item_id ON prod.order_item_fulfillments (order_item_id);
