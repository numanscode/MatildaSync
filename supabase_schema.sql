-- ============================================================================
-- MATILDA STORE - SUPABASE DATABASE SCHEMA & POLICIES
-- Project: https://utcumpugoogwsgafotlh.supabase.co
-- ============================================================================

-- 1. Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    original_price NUMERIC(10, 2),
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    collection TEXT DEFAULT 'all',
    image_url TEXT DEFAULT '',
    additional_images JSONB DEFAULT '[]'::jsonb,
    variants JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    stock_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_new_arrival BOOLEAN DEFAULT false,
    is_best_seller BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- ============================================================================
-- 3. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- ============================================================================
-- 4. ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    shipping_address JSONB DEFAULT '{}'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(10, 2) DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    shipping_fee NUMERIC(10, 2) DEFAULT 0.00,
    payment_method TEXT DEFAULT 'upi',
    utr_number TEXT DEFAULT '',
    screenshot_url TEXT DEFAULT '',
    payment_screenshot TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    fulfillment_status TEXT DEFAULT 'unfulfilled',
    courier_name TEXT DEFAULT '',
    tracking_number TEXT DEFAULT '',
    rejection_reason TEXT DEFAULT '',
    promo_code TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    synced BOOLEAN DEFAULT true
);

-- Indexes for order tracking & admin search
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ============================================================================
-- 5. CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    phone TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    order_count INTEGER DEFAULT 1,
    total_spent NUMERIC(10, 2) DEFAULT 0.00,
    is_blacklisted BOOLEAN DEFAULT false,
    last_order_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_blacklisted ON public.customers(is_blacklisted);

-- ============================================================================
-- 6. STORE SETTINGS & PROMOS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.store_settings (
    id TEXT PRIMARY KEY,
    key TEXT,
    value JSONB DEFAULT '{}'::jsonb,
    promo_codes JSONB DEFAULT '[]'::jsonb,
    sale_active BOOLEAN DEFAULT false,
    sale_title TEXT DEFAULT '',
    sale_discount_type TEXT DEFAULT 'percentage',
    sale_discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures instant read and write access for both client (anon key) and server
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Products Policies: Public read, insert, update, delete
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Public delete products" ON public.products FOR DELETE USING (true);

-- Categories Policies
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public insert categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Public delete categories" ON public.categories FOR DELETE USING (true);

-- Orders Policies
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Public delete orders" ON public.orders FOR DELETE USING (true);

-- Customers Policies
CREATE POLICY "Public read customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Public insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Public delete customers" ON public.customers FOR DELETE USING (true);

-- Store Settings Policies
CREATE POLICY "Public read store_settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Public insert store_settings" ON public.store_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update store_settings" ON public.store_settings FOR UPDATE USING (true);
CREATE POLICY "Public delete store_settings" ON public.store_settings FOR DELETE USING (true);

-- ============================================================================
-- 8. STORAGE BUCKET CONFIGURATION (product-images)
-- ============================================================================
-- Insert public storage bucket if not present
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for 'product-images'
CREATE POLICY "Public Access product-images" ON storage.objects 
FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Public Upload product-images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Public Update product-images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'product-images');

CREATE POLICY "Public Delete product-images" ON storage.objects 
FOR DELETE USING (bucket_id = 'product-images');
