-- Create invoices table for Australian business
-- Supports GST, multiple currencies, payment tracking, and audit requirements

CREATE TABLE IF NOT EXISTS dev.invoices (
    -- Core identifiers
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INTEGER NOT NULL REFERENCES dev.orders(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    
    -- Dates - Australian business standard
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    due_date DATE NOT NULL, -- Payment due date (e.g., Net 30)
    paid_at TIMESTAMP,
    sent_at TIMESTAMP,
    
    -- Financial breakdown (in AUD cents to avoid float precision issues)
    subtotal DECIMAL(12,2) NOT NULL,
    gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0, -- Australian GST (10%)
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_charges DECIMAL(12,2) NOT NULL DEFAULT 0, -- Shipping, fees, etc.
    total_amount DECIMAL(12,2) NOT NULL,
    
    -- Payment tracking
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_due DECIMAL(12,2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'AUD',
    
    -- Invoice status
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, issued, sent, partially_paid, paid, overdue, cancelled
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- unpaid, partially_paid, paid
    
    -- Addresses (snapshot at time of invoice)
    billing_address JSONB,
    shipping_address JSONB,
    
    -- Business metadata
    po_number VARCHAR(50), -- Customer PO reference
    payment_terms_days INTEGER DEFAULT 30, -- Net 30, Net 60, etc.
    payment_method VARCHAR(50), -- Bank transfer, credit card, cash, cheque
    notes TEXT,
    terms_and_conditions TEXT, -- Custom T&Cs or template reference
    
    -- Customer information (for B2B)
    customer_details JSONB, -- {abn, name, email, phone, ...}
    
    -- Seller information (company snapshot at time of invoicing)
    company_details JSONB NOT NULL, -- {abn, name, address, phone, email, website, logo_url}
    
    -- Extensible data for future requirements
    metadata JSONB, -- {custom_field_1, custom_field_2, ...}
    
    -- PDF/Document storage
    pdf_url TEXT, -- URL to stored PDF in S3
    pdf_generated_at TIMESTAMP,
    
    -- Audit and tracking
    sent_count INTEGER DEFAULT 0, -- Number of times invoice was sent
    last_sent_at TIMESTAMP,
    reference_number VARCHAR(100), -- Internal reference
    notes_internal TEXT, -- Internal notes not shown to customer
    
    -- Audit trail
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Soft delete support
    deleted_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_invoices_order_id ON dev.invoices(order_id);
CREATE INDEX idx_invoices_user_id ON dev.invoices(user_id);
CREATE INDEX idx_invoices_invoice_number ON dev.invoices(invoice_number);
CREATE INDEX idx_invoices_status ON dev.invoices(status);
CREATE INDEX idx_invoices_payment_status ON dev.invoices(payment_status);
CREATE INDEX idx_invoices_issued_at ON dev.invoices(issued_at);
CREATE INDEX idx_invoices_due_date ON dev.invoices(due_date);
CREATE INDEX idx_invoices_created_at ON dev.invoices(created_at);
CREATE INDEX idx_invoices_deleted_at ON dev.invoices(deleted_at); -- For soft deletes

-- Create composite index for common queries
CREATE INDEX idx_invoices_user_status ON dev.invoices(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_order_user ON dev.invoices(order_id, user_id);

-- Trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION dev.generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number = TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                             LPAD(NEXTVAL('dev.invoice_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
BEFORE INSERT ON dev.invoices
FOR EACH ROW
EXECUTE FUNCTION dev.generate_invoice_number();

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION dev.update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoices_updated_at
BEFORE UPDATE ON dev.invoices
FOR EACH ROW
EXECUTE FUNCTION dev.update_invoices_updated_at();

-- Trigger to auto-calculate amount_due
CREATE OR REPLACE FUNCTION dev.update_invoices_amount_due()
RETURNS TRIGGER AS $$
BEGIN
    NEW.amount_due = NEW.total_amount - NEW.amount_paid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoices_amount_due
BEFORE INSERT OR UPDATE ON dev.invoices
FOR EACH ROW
EXECUTE FUNCTION dev.update_invoices_amount_due();

-- Create sequence for invoice numbers (starts from 1000)
CREATE SEQUENCE IF NOT EXISTS dev.invoice_number_seq START 1000;
