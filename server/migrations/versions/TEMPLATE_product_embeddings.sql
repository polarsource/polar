-- Template Alembic Migration: Add product_embeddings table for RAG
--
-- This is a TEMPLATE - generate actual migration with:
-- uv run alembic revision --autogenerate -m "add product_embeddings for RAG"
--
-- Week 4: RAG Knowledge System
--
-- IMPORTANT: Run this after setting up pgvector extension

-- ============================================================================
-- STEP 1: Enable pgvector extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- STEP 2: Create product_embeddings table
-- ============================================================================

CREATE TABLE product_embeddings (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to products
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Embedding vector (1536 dimensions for OpenAI text-embedding-3-small)
    embedding vector(1536) NOT NULL,

    -- Cached product text for debugging
    content TEXT NOT NULL,

    -- Metadata (JSONB for flexible schema)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- RecordModel fields (Polar pattern)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    modified_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT unique_product_embedding UNIQUE(product_id)
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

-- Index on product_id for joins
CREATE INDEX idx_product_embeddings_product_id
    ON product_embeddings(product_id);

-- Index on deleted_at for soft deletes
CREATE INDEX idx_product_embeddings_deleted_at
    ON product_embeddings(deleted_at)
    WHERE deleted_at IS NULL;

-- Vector similarity index (ivfflat)
-- lists = 100 for <10K products
-- Adjust to 1000 for 100K+ products
CREATE INDEX idx_product_embeddings_vector
    ON product_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Alternative: HNSW index (better accuracy, slower build)
-- CREATE INDEX idx_product_embeddings_vector
--     ON product_embeddings
--     USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- STEP 4: Set query parameters
-- ============================================================================

-- Set ivfflat probes for query accuracy (session-level)
-- Higher probes = more accurate but slower
-- 10 is a good balance
-- SET ivfflat.probes = 10;

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

-- Grant access to application user (adjust username as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON product_embeddings TO polar_app;
-- GRANT USAGE ON SEQUENCE product_embeddings_id_seq TO polar_app;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Test vector search (cosine distance)
-- Example: Find products similar to a query embedding
/*
SELECT
    p.id,
    p.name,
    p.description,
    1 - (pe.embedding <=> '[0.1, 0.2, ...]'::vector) as similarity_score
FROM product_embeddings pe
JOIN products p ON pe.product_id = p.id
WHERE pe.deleted_at IS NULL
ORDER BY pe.embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
*/

-- Check index usage
/*
EXPLAIN ANALYZE
SELECT * FROM product_embeddings
WHERE deleted_at IS NULL
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

-- Vector Similarity Operators:
-- <=> : Cosine distance (1 - cosine similarity)
-- <-> : Euclidean distance (L2)
-- <#> : Negative inner product

-- Index Types:
-- ivfflat: Fast approximate search, good for most use cases
-- hnsw: More accurate but slower build time, better for >100K vectors

-- Performance Tips:
-- 1. Use cosine distance (<=>)for normalized embeddings
-- 2. Set ivfflat.probes based on accuracy needs (1-100)
-- 3. Periodically rebuild index: CREATE INDEX CONCURRENTLY
-- 4. Monitor index size: SELECT pg_size_pretty(pg_total_relation_size('idx_product_embeddings_vector'));

-- Migration Path to Pinecone:
-- If vector search becomes slow (>100ms for 100K+ products), consider:
-- 1. Keep product_embeddings table for metadata
-- 2. Move vectors to Pinecone
-- 3. Update KnowledgeService to use Pinecone client
-- 4. Use pgvector as fallback

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this migration:
/*
DROP INDEX IF EXISTS idx_product_embeddings_vector;
DROP INDEX IF EXISTS idx_product_embeddings_deleted_at;
DROP INDEX IF EXISTS idx_product_embeddings_product_id;
DROP TABLE IF EXISTS product_embeddings;
-- DROP EXTENSION IF EXISTS vector; -- Only if not used elsewhere
*/
