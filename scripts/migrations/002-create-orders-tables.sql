-- Migration: Create orders and order items tables
-- Stores customer orders and order items with pricing snapshots

-- Create orders table for dev schema
CREATE TABLE
  dev.orders (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'AUD',
    notes TEXT,
    shipping_address JSONB,
    billing_address JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for orders table
CREATE INDEX idx_dev_orders_user_id ON dev.orders (user_id);

CREATE INDEX idx_dev_orders_order_number ON dev.orders (order_number);

CREATE INDEX idx_dev_orders_status ON dev.orders (status);

CREATE INDEX idx_dev_orders_created_at ON dev.orders (created_at DESC);

CREATE INDEX idx_dev_orders_updated_at ON dev.orders (updated_at DESC);

-- Create order items table for dev schema
CREATE TABLE
  dev.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES dev.orders (id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES dev.products (id),
    variant_id INTEGER NOT NULL REFERENCES dev.product_variants (id),
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    variant_title VARCHAR(255),
    selected_option JSONB,
    image TEXT,
    quantity INTEGER NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'AUD',
    line_total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for order items table
CREATE INDEX idx_dev_order_items_order_id ON dev.order_items (order_id);

CREATE INDEX idx_dev_order_items_product_id ON dev.order_items (product_id);

CREATE INDEX idx_dev_order_items_variant_id ON dev.order_items (variant_id);

-- Create orders table for prod schema
CREATE TABLE
  prod.orders (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'AUD',
    notes TEXT,
    shipping_address JSONB,
    billing_address JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for orders table
CREATE INDEX idx_prod_orders_user_id ON prod.orders (user_id);

CREATE INDEX idx_prod_orders_order_number ON prod.orders (order_number);

CREATE INDEX idx_prod_orders_status ON prod.orders (status);

CREATE INDEX idx_prod_orders_created_at ON prod.orders (created_at DESC);

CREATE INDEX idx_prod_orders_updated_at ON prod.orders (updated_at DESC);

-- Create order items table for prod schema
CREATE TABLE
  prod.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES prod.orders (id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES prod.products (id),
    variant_id INTEGER NOT NULL REFERENCES prod.product_variants (id),
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    variant_title VARCHAR(255),
    selected_option JSONB,
    image TEXT,
    quantity INTEGER NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'AUD',
    line_total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for order items table
CREATE INDEX idx_prod_order_items_order_id ON prod.order_items (order_id);

CREATE INDEX idx_prod_order_items_product_id ON prod.order_items (product_id);

CREATE INDEX idx_prod_order_items_variant_id ON prod.order_items (variant_id);

-- Create payments table for dev schema
CREATE TABLE
  dev.payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES dev.orders (id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_details JSONB,
    transaction_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for payments table
CREATE INDEX idx_dev_payments_order_id ON dev.payments (order_id);

CREATE INDEX idx_dev_payments_status ON dev.payments (status);

CREATE INDEX idx_dev_payments_payment_method ON dev.payments (payment_method);

CREATE INDEX idx_dev_payments_created_at ON dev.payments (created_at DESC);

-- Create payments table for prod schema
CREATE TABLE
  prod.payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES prod.orders (id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_details JSONB,
    transaction_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW ()
  );

-- Create indexes for payments table
CREATE INDEX idx_prod_payments_order_id ON prod.payments (order_id);

CREATE INDEX idx_prod_payments_status ON prod.payments (status);

CREATE INDEX idx_prod_payments_payment_method ON prod.payments (payment_method);

CREATE INDEX idx_prod_payments_created_at ON prod.payments (created_at DESC);
