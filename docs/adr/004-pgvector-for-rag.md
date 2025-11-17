# ADR 004: pgvector for RAG Knowledge Base

**Status**: Accepted

**Date**: 2025-11-17

**Context**:

AgentPay needs semantic product search for conversational commerce. When a user asks "I need trail running shoes under $150", we must:

1. **Embed query**: Convert to vector (1536 dimensions with OpenAI)
2. **Search catalog**: Find semantically similar products
3. **Return results**: Ranked by relevance + filters (price, category)

We evaluated vector database options:

| **Option** | **Pros** | **Cons** |
|------------|----------|----------|
| **pgvector** | PostgreSQL extension, no new infra, ACID, joins | Slower than purpose-built (10-50ms) |
| **Pinecone** | Fast (5-10ms), managed, scale to billions | $70+/month, external dependency |
| **Weaviate** | Open source, fast, multi-tenant | New infrastructure, ops complexity |
| **Qdrant** | Rust performance, filtering | New infrastructure, less mature |
| **In-memory** | Ultra fast (1ms) | No persistence, limited scale |

**Decision**:

We will use **pgvector for MVP** (Week 4-6) with **Pinecone migration path** for scale (if needed):

**Phase 1: pgvector (Week 4-6)**
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE product_embeddings (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON product_embeddings USING ivfflat (embedding vector_cosine_ops);
```

**Query Example**:
```python
# Find similar products
query_embedding = await openai_client.embed("trail running shoes")

products = await session.execute(
    select(Product)
    .join(ProductEmbedding)
    .order_by(ProductEmbedding.embedding.cosine_distance(query_embedding))
    .limit(5)
)
```

**Phase 2: Pinecone (if scale requires)**
- Migrate when catalog >100K products or latency >100ms
- Keep pgvector for ACID properties (product metadata)
- Use Pinecone only for vector search

**Consequences**:

**Positive**:
- **Zero new infrastructure**: Leverage existing PostgreSQL
- **ACID guarantees**: Product updates are transactional
- **SQL joins**: Combine vector search with filters (price, category, stock)
- **Simple ops**: No new service to monitor/scale
- **Cost efficient**: No $70/month Pinecone tier for MVP
- **Local dev**: Works in docker compose, no API keys
- **Proven**: GitHub, Supabase, Tembo use pgvector in production

**Negative**:
- **Slower than Pinecone**: 10-50ms vs 5-10ms (acceptable for conversational UX)
- **Limited scale**: Performance degrades >1M vectors (we have <10K products in MVP)
- **Index tuning**: Need to tune ivfflat parameters (lists, probes)
- **Memory usage**: Embeddings stored in Postgres RAM (1536 dims * 4 bytes = 6KB per product)

**Performance Targets**:
- **10K products**: <20ms query (pgvector)
- **100K products**: <50ms query (pgvector with tuning)
- **1M+ products**: Migrate to Pinecone (<10ms)

**Embedding Strategy**:

**OpenAI text-embedding-3-small** ($0.02 per 1M tokens):
```python
class EmbeddingService:
    async def embed_product(self, product: Product) -> list[float]:
        text = f"{product.name}\n{product.description}\n{product.category}"
        response = await openai.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding  # 1536 dimensions
```

**Caching** (Redis):
- Cache query embeddings (TTL 1 hour)
- Pre-compute product embeddings on creation/update
- Invalidate cache on product updates

**Index Configuration**:
```sql
-- For <10K products
CREATE INDEX ON product_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- For 100K products
CREATE INDEX ON product_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);

-- Set probes for query
SET ivfflat.probes = 10;
```

**Migration Path to Pinecone**:
```python
class VectorStore(ABC):
    async def search(self, embedding, limit) -> list[Product]:
        pass

class PgvectorStore(VectorStore):
    # Current implementation

class PineconeStore(VectorStore):
    # Future implementation

# Config-driven selection
vector_store = PgvectorStore() if config.VECTOR_DB == "pgvector" else PineconeStore()
```

**Monitoring**:
- Track query latency (p50, p95, p99)
- Monitor index size and memory usage
- Alert if latency >100ms
- Trigger Pinecone migration if sustained >100ms

**Testing**:
```python
async def test_semantic_search():
    # Insert test products
    await embed_and_store(Product(name="Nike Trail Runner"))

    # Search
    results = await vector_store.search("running shoes for trails", limit=5)

    # Assert relevance
    assert "Nike Trail Runner" in [p.name for p in results]
```

**Cost Analysis**:

**pgvector (MVP)**:
- Infrastructure: $0 (existing Postgres)
- Embeddings: $0.02 per 1M tokens = $0.20 for 10K products
- Total: ~$0.20 one-time

**Pinecone (scale)**:
- Starter: $70/month (100K vectors, 1 pod)
- Standard: $360/month (1M vectors, 5 pods)
- Embeddings: Same $0.02 per 1M tokens

**Break-even**: Stay on pgvector until scale justifies $840/year Pinecone cost.

**References**:
- pgvector docs: https://github.com/pgvector/pgvector
- OpenAI embeddings: https://platform.openai.com/docs/guides/embeddings
- `server/polar/agent_knowledge/vector_store.py` (future implementation)
