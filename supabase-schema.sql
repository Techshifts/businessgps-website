-- BusinessGPS.ai Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up your database

-- =====================
-- ORDERS TABLE
-- =====================
-- Stores all successful Stripe purchases
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    product_id TEXT NOT NULL,
    amount_gbp INTEGER,  -- Amount in pence
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick email lookups
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_customer ON orders(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- =====================
-- PRODUCT ACCESS TABLE
-- =====================
-- Tracks which products a customer has access to
CREATE TABLE IF NOT EXISTS product_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    product_id TEXT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,  -- NULL = never expires
    cohort_id TEXT,  -- For Start Right 30 cohort assignment
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    UNIQUE(email, product_id)
);

-- Index for checking access
CREATE INDEX IF NOT EXISTS idx_product_access_email ON product_access(email);
CREATE INDEX IF NOT EXISTS idx_product_access_product ON product_access(product_id);

-- =====================
-- COHORTS TABLE
-- =====================
-- For managing Start Right 30 cohort enrollments
CREATE TABLE IF NOT EXISTS cohorts (
    id TEXT PRIMARY KEY,  -- e.g., "SR30-2026-Q1"
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    max_participants INTEGER DEFAULT 20,
    current_participants INTEGER DEFAULT 0,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- LEADS TABLE
-- =====================
-- For TCM report downloads and other lead magnets
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    first_name TEXT,
    company TEXT,
    source TEXT,  -- e.g., 'tcm-report', 'athena-trial'
    tags TEXT[],  -- Array of tags
    aweber_synced BOOLEAN DEFAULT FALSE,
    hubspot_synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(email, source)
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

-- =====================
-- API TOKENS TABLE
-- =====================
-- Stores OAuth tokens that need periodic refresh (e.g., AWeber)
CREATE TABLE IF NOT EXISTS api_tokens (
    service TEXT PRIMARY KEY,  -- e.g., 'aweber'
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- =====================
-- FUNCTIONS
-- =====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check if email has access to product
CREATE OR REPLACE FUNCTION has_product_access(p_email TEXT, p_product_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM product_access
        WHERE email = p_email
        AND product_id = p_product_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Function to increment cohort participants
CREATE OR REPLACE FUNCTION increment_cohort_participants(p_cohort_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE cohorts
    SET current_participants = current_participants + 1
    WHERE id = p_cohort_id
    AND current_participants < max_participants;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cohort is full or does not exist';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- ROW LEVEL SECURITY
-- =====================
-- Enable RLS on all tables (Supabase best practice)

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for Netlify functions)
-- Note: Using service_role key bypasses RLS

-- =====================
-- SAMPLE DATA (Optional)
-- =====================
-- Uncomment to create a test cohort

-- INSERT INTO cohorts (id, name, start_date, max_participants, status)
-- VALUES ('SR30-2026-Q1', 'Start Right 30 - Q1 2026', '2026-03-01', 20, 'upcoming');
