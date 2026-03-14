-- CoreInventory Database Schema
-- PostgreSQL 14+
-- Author: CoreInventory Team
-- Description: Full inventory management schema with stock ledger

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE move_type AS ENUM ('receipt', 'delivery', 'internal', 'adjustment');
CREATE TYPE move_status AS ENUM ('draft', 'waiting', 'ready', 'done', 'cancelled');
CREATE TYPE move_direction AS ENUM ('in', 'out', 'internal');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'staff',
    otp_code        VARCHAR(6),
    otp_expires_at  TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE warehouses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(120) NOT NULL,
    short_code      VARCHAR(20) UNIQUE NOT NULL,
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOCATIONS (Sub-locations within warehouses: racks, floors, zones)
-- ============================================================
CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    short_code      VARCHAR(20) NOT NULL,
    parent_id       UUID REFERENCES locations(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(warehouse_id, short_code)
);

CREATE INDEX idx_locations_warehouse ON locations(warehouse_id);

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    sku             VARCHAR(80) UNIQUE NOT NULL,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'pcs',
    reorder_point   NUMERIC(12,3) NOT NULL DEFAULT 0,
    reorder_qty     NUMERIC(12,3) NOT NULL DEFAULT 0,
    description     TEXT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,  -- soft delete
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_deleted) WHERE is_deleted = FALSE;

-- ============================================================
-- STOCK LEDGER (Core of inventory — double-entry style)
-- Every movement creates a row here. Current stock = SUM of qty.
-- ============================================================
CREATE TABLE stock_moves (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference       VARCHAR(60) UNIQUE NOT NULL,   -- e.g., REC/2024/001
    type            move_type NOT NULL,
    status          move_status NOT NULL DEFAULT 'draft',
    direction       move_direction NOT NULL,
    product_id      UUID NOT NULL REFERENCES products(id),
    from_location   UUID REFERENCES locations(id),
    to_location     UUID REFERENCES locations(id),
    qty_planned     NUMERIC(12,3) NOT NULL CHECK (qty_planned >= 0),
    qty_done        NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (qty_done >= 0),
    supplier        VARCHAR(200),     -- for receipts
    customer        VARCHAR(200),     -- for deliveries
    notes           TEXT,
    done_at         TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure either from or to location is set
    CONSTRAINT chk_locations CHECK (from_location IS NOT NULL OR to_location IS NOT NULL)
);

CREATE INDEX idx_stock_moves_product  ON stock_moves(product_id);
CREATE INDEX idx_stock_moves_type     ON stock_moves(type);
CREATE INDEX idx_stock_moves_status   ON stock_moves(status);
CREATE INDEX idx_stock_moves_ref      ON stock_moves(reference);
CREATE INDEX idx_stock_moves_created  ON stock_moves(created_at DESC);
CREATE INDEX idx_stock_moves_from_loc ON stock_moves(from_location);
CREATE INDEX idx_stock_moves_to_loc   ON stock_moves(to_location);

-- ============================================================
-- STOCK SNAPSHOT (Materialized view for fast stock queries)
-- Updated via function when moves are validated
-- ============================================================
CREATE TABLE stock_snapshot (
    product_id      UUID NOT NULL REFERENCES products(id),
    location_id     UUID NOT NULL REFERENCES locations(id),
    qty_on_hand     NUMERIC(12,3) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, location_id)
);

CREATE INDEX idx_stock_snapshot_product  ON stock_snapshot(product_id);
CREATE INDEX idx_stock_snapshot_location ON stock_snapshot(location_id);

-- ============================================================
-- FUNCTION: Update stock snapshot after a move is validated
-- ============================================================
CREATE OR REPLACE FUNCTION update_stock_snapshot(
    p_product_id    UUID,
    p_from_location UUID,
    p_to_location   UUID,
    p_qty           NUMERIC,
    p_direction     move_direction
) RETURNS VOID AS $$
BEGIN
    -- For receipts / in movements: increase stock at to_location
    IF p_direction = 'in' AND p_to_location IS NOT NULL THEN
        INSERT INTO stock_snapshot (product_id, location_id, qty_on_hand)
        VALUES (p_product_id, p_to_location, p_qty)
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            qty_on_hand = stock_snapshot.qty_on_hand + p_qty,
            updated_at = NOW();

    -- For deliveries / out movements: decrease stock at from_location
    ELSIF p_direction = 'out' AND p_from_location IS NOT NULL THEN
        UPDATE stock_snapshot
        SET qty_on_hand = GREATEST(qty_on_hand - p_qty, 0),
            updated_at = NOW()
        WHERE product_id = p_product_id AND location_id = p_from_location;

    -- For internal transfers: move stock between locations
    ELSIF p_direction = 'internal' THEN
        -- Decrease from source
        UPDATE stock_snapshot
        SET qty_on_hand = GREATEST(qty_on_hand - p_qty, 0),
            updated_at = NOW()
        WHERE product_id = p_product_id AND location_id = p_from_location;

        -- Increase at destination
        INSERT INTO stock_snapshot (product_id, location_id, qty_on_hand)
        VALUES (p_product_id, p_to_location, p_qty)
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            qty_on_hand = stock_snapshot.qty_on_hand + p_qty,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate sequential references (REC/2024/001)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS seq_receipt    START 1;
CREATE SEQUENCE IF NOT EXISTS seq_delivery   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_internal   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_adjustment START 1;

CREATE OR REPLACE FUNCTION generate_reference(p_type move_type)
RETURNS VARCHAR AS $$
DECLARE
    prefix    VARCHAR;
    seq_val   BIGINT;
    year_part VARCHAR;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    CASE p_type
        WHEN 'receipt'     THEN prefix := 'REC';    seq_val := NEXTVAL('seq_receipt');
        WHEN 'delivery'    THEN prefix := 'DEL';    seq_val := NEXTVAL('seq_delivery');
        WHEN 'internal'    THEN prefix := 'INT';    seq_val := NEXTVAL('seq_internal');
        WHEN 'adjustment'  THEN prefix := 'ADJ';    seq_val := NEXTVAL('seq_adjustment');
    END CASE;
    RETURN prefix || '/' || year_part || '/' || LPAD(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUDIT LOG (track all important changes)
-- ============================================================
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name  VARCHAR(60) NOT NULL,
    record_id   UUID NOT NULL,
    action      VARCHAR(20) NOT NULL,  -- INSERT, UPDATE, DELETE
    old_data    JSONB,
    new_data    JSONB,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table  ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_date   ON audit_log(performed_at DESC);

-- ============================================================
-- UPDATED_AT trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stock_moves_updated_at
    BEFORE UPDATE ON stock_moves
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
