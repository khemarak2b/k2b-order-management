-- Migration: Add tracking number and URL fields to orders
-- Allows admins to add carrier tracking information for shipped orders

-- Add tracking fields to dev schema
ALTER TABLE dev.orders
ADD COLUMN tracking_number VARCHAR(100),
ADD COLUMN tracking_url TEXT;

-- Add tracking fields to prod schema
ALTER TABLE prod.orders
ADD COLUMN tracking_number VARCHAR(100),
ADD COLUMN tracking_url TEXT;

-- Create indexes for tracking number lookup (useful for customer inquiries)
CREATE INDEX idx_dev_orders_tracking_number ON dev.orders (tracking_number);
CREATE INDEX idx_prod_orders_tracking_number ON prod.orders (tracking_number);
