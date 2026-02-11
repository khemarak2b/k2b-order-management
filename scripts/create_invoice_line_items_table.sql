-- Create invoice_line_items table
-- Snapshot of order items at time of invoicing (for audit/compliance)

CREATE TABLE IF NOT EXISTS dev.invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES dev.invoices(id) ON DELETE CASCADE,
    order_item_id INTEGER, -- Reference to original order item (if exists)
    
    -- Line item details
    product_id VARCHAR(255),
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50),
    variant_id INTEGER,
    variant_name VARCHAR(255),
    
    -- Quantity and pricing
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    
    -- Tax
    gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    gst_included BOOLEAN DEFAULT FALSE, -- Whether GST is included in unit_price or additional
    
    -- Discount (per line item)
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Description
    description TEXT,
    notes TEXT,
    
    -- Extensible data for future requirements
    metadata JSONB, -- {batch_number, lot_number, custom_attributes, ...}
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_invoice_line_items_invoice_id ON dev.invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_order_item_id ON dev.invoice_line_items(order_item_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION dev.update_invoice_line_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_line_items_updated_at
BEFORE UPDATE ON dev.invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION dev.update_invoice_line_items_updated_at();


-- Create invoice_payments table
-- Track individual payments against invoices (for GST reconciliation and audits)

CREATE TABLE IF NOT EXISTS dev.invoice_payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES dev.invoices(id) ON DELETE CASCADE,
    
    -- Payment details
    payment_id INTEGER REFERENCES dev.payments(id), -- Link to orders.payments if exists
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50), -- Bank transfer, credit card, cheque, cash
    payment_reference VARCHAR(100), -- Bank ref, transaction ID, cheque number
    
    -- Dates
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Status and notes
    status VARCHAR(20) DEFAULT 'completed', -- completed, pending, failed, reversed
    notes TEXT,
    
    -- Audit
    recorded_by UUID, -- Admin who recorded the payment
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_invoice_payments_invoice_id ON dev.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment_id ON dev.invoice_payments(payment_id);
CREATE INDEX idx_invoice_payments_payment_date ON dev.invoice_payments(payment_date);
CREATE INDEX idx_invoice_payments_status ON dev.invoice_payments(status);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION dev.update_invoice_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_payments_updated_at
BEFORE UPDATE ON dev.invoice_payments
FOR EACH ROW
EXECUTE FUNCTION dev.update_invoice_payments_updated_at();
