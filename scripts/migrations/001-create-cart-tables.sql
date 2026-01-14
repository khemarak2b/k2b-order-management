-- Migration: Create cart and cart items tables
-- Stores user shopping cart and items with product/variant snapshots
-- Create cart table for dev schema
CREATE TABLE
  dev.carts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW (),
    created_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for cart table
CREATE INDEX idx_dev_carts_user_id ON dev.carts (user_id);

CREATE INDEX idx_dev_carts_updated_at ON dev.carts (updated_at DESC);

-- Create cart items table for dev schema
CREATE TABLE
  dev.cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER NOT NULL REFERENCES dev.carts (id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES dev.products (id),
    variant_id INTEGER NOT NULL REFERENCES dev.product_variants (id),
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    variant_title VARCHAR(255),
    selected_option JSONB,
    image TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    currency_code VARCHAR(3) DEFAULT 'AUD',
    minimum_order_quantity INTEGER,
    minimum_order_value DECIMAL(10, 2),
    total_inventory INTEGER,
    added_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for cart items table
CREATE INDEX idx_dev_cart_items_cart_id ON dev.cart_items (cart_id);

CREATE INDEX idx_dev_cart_items_product_id ON dev.cart_items (product_id);

CREATE INDEX idx_dev_cart_items_variant_id ON dev.cart_items (variant_id);

CREATE INDEX idx_dev_cart_items_added_at ON dev.cart_items (added_at DESC);

-- Create cart table for prod schema
CREATE TABLE
  prod.carts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW (),
    created_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for cart table
CREATE INDEX idx_prod_carts_user_id ON prod.carts (user_id);

CREATE INDEX idx_prod_carts_updated_at ON prod.carts (updated_at DESC);

-- Create cart items table for prod schema
CREATE TABLE
  prod.cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER NOT NULL REFERENCES prod.carts (id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES prod.products (id),
    variant_id INTEGER NOT NULL REFERENCES prod.product_variants (id),
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    variant_title VARCHAR(255),
    selected_option JSONB,
    image TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    currency_code VARCHAR(3) DEFAULT 'AUD',
    minimum_order_quantity INTEGER,
    minimum_order_value DECIMAL(10, 2),
    total_inventory INTEGER,
    added_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for cart items table
CREATE INDEX idx_prod_cart_items_cart_id ON prod.cart_items (cart_id);

CREATE INDEX idx_prod_cart_items_product_id ON prod.cart_items (product_id);

CREATE INDEX idx_prod_cart_items_variant_id ON prod.cart_items (variant_id);

CREATE INDEX idx_prod_cart_items_added_at ON prod.cart_items (added_at DESC);