-- ============================================================================
-- PostgreSQL Initialization Script for AgentPay
-- ============================================================================
-- This script runs automatically when the PostgreSQL container is created
-- Enables pgvector extension for semantic search
-- ============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Create indexes optimization settings
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Reload configuration
SELECT pg_reload_conf();

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE agentpay_production TO agentpay;
