-- TerraQura domain backbone schema
-- Initial normalized spine for enterprise workflows and audit queries.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS domain_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('operator', 'buyer', 'sovereign', 'verifier', 'internal')),
  jurisdiction_code TEXT,
  data_residency_region TEXT NOT NULL DEFAULT 'me-south-1',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'offboarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES domain_tenants(id),
  wallet_address TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'auditor', 'buyer', 'viewer')),
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
  kyc_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, wallet_address)
);

CREATE TABLE IF NOT EXISTS domain_dac_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES domain_tenants(id),
  facility_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  commissioning_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'decommissioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_dac_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES domain_dac_facilities(id),
  unit_code TEXT NOT NULL UNIQUE,
  onchain_unit_id TEXT UNIQUE,
  capture_method TEXT NOT NULL DEFAULT 'direct_air_capture',
  rated_capacity_kg_per_day NUMERIC(18, 6),
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'whitelisted', 'active', 'paused', 'retired')),
  whitelisted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_verification_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dac_unit_id UUID NOT NULL REFERENCES domain_dac_units(id),
  capture_start_at TIMESTAMPTZ NOT NULL,
  capture_end_at TIMESTAMPTZ NOT NULL,
  source_data_hash TEXT NOT NULL,
  telemetry_window_hash TEXT,
  total_co2_captured_kg NUMERIC(18, 6) NOT NULL,
  total_energy_kwh NUMERIC(18, 6) NOT NULL,
  efficiency_factor NUMERIC(18, 8),
  quality_score NUMERIC(10, 6),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'verifying', 'verified', 'rejected', 'minted')),
  verifier_service_version TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (capture_end_at > capture_start_at)
);

CREATE TABLE IF NOT EXISTS domain_carbon_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_batch_id UUID NOT NULL UNIQUE REFERENCES domain_verification_batches(id),
  token_id TEXT UNIQUE,
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  initial_quantity NUMERIC(18, 6) NOT NULL,
  available_quantity NUMERIC(18, 6) NOT NULL,
  retired_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  owner_wallet TEXT NOT NULL,
  mint_tx_hash TEXT,
  metadata_uri TEXT,
  status TEXT NOT NULL DEFAULT 'pending_mint'
    CHECK (status IN ('pending_mint', 'minted', 'listed', 'partially_retired', 'retired', 'frozen')),
  minted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (available_quantity >= 0),
  CHECK (retired_quantity >= 0),
  CHECK (initial_quantity >= available_quantity + retired_quantity)
);

CREATE TABLE IF NOT EXISTS domain_market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carbon_instrument_id UUID NOT NULL REFERENCES domain_carbon_instruments(id),
  listing_id TEXT,
  seller_wallet TEXT NOT NULL,
  buyer_wallet TEXT,
  quantity NUMERIC(18, 6) NOT NULL,
  price_per_unit_wei NUMERIC(78, 0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partially_filled', 'filled', 'cancelled', 'expired')),
  create_tx_hash TEXT,
  settlement_tx_hash TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS domain_retirement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carbon_instrument_id UUID NOT NULL REFERENCES domain_carbon_instruments(id),
  retired_by_wallet TEXT NOT NULL,
  beneficiary_name TEXT,
  quantity NUMERIC(18, 6) NOT NULL,
  reason TEXT NOT NULL,
  certificate_token_id TEXT,
  retirement_tx_hash TEXT,
  retired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  tenant_id UUID REFERENCES domain_tenants(id),
  chain_id INTEGER,
  tx_hash TEXT,
  payload JSONB NOT NULL,
  causation_id UUID,
  correlation_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate
  ON domain_events (aggregate_type, aggregate_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_events_tenant
  ON domain_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_batches_unit_time
  ON domain_verification_batches (dac_unit_id, capture_start_at, capture_end_at);

CREATE INDEX IF NOT EXISTS idx_carbon_instruments_owner
  ON domain_carbon_instruments (owner_wallet, status);

CREATE INDEX IF NOT EXISTS idx_retirement_records_instrument
  ON domain_retirement_records (carbon_instrument_id, retired_at DESC);
