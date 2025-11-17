"""Vector store using PostgreSQL pgvector extension."""

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent_knowledge.base import SearchResult, VectorStore
from polar.kit.db.models import RecordModel
from polar.kit.db.postgres import AsyncSessionMaker


class PgvectorStore(VectorStore):
    """
    Vector store using pgvector extension.

    Performance:
    - <20ms for 10K vectors
    - <50ms for 100K vectors (with tuning)
    - Requires pgvector extension: CREATE EXTENSION vector;

    Index configuration:
    - ivfflat with lists=100 for <10K vectors
    - ivfflat with lists=1000 for 100K vectors
    - Set ivfflat.probes=10 for query accuracy
    """

    def __init__(
        self,
        session_maker: AsyncSessionMaker,
        table_name: str = "product_embeddings",
        dimensions: int = 1536,
    ):
        """
        Initialize pgvector store.

        Args:
            session_maker: SQLAlchemy async session maker
            table_name: Name of embeddings table
            dimensions: Vector dimensions (1536 for OpenAI)
        """
        self.session_maker = session_maker
        self.table_name = table_name
        self.dimensions = dimensions

    async def search(
        self,
        embedding: list[float],
        limit: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """
        Search for similar vectors using cosine distance.

        Args:
            embedding: Query vector
            limit: Max results
            filters: Metadata filters (product_id, category, etc.)

        Returns:
            List of SearchResult ordered by similarity
        """
        async with self.session_maker() as session:
            # Build query with cosine distance
            # TODO: Replace raw SQL with SQLAlchemy model in Week 4-6
            query = f"""
                SELECT
                    id,
                    content,
                    metadata,
                    1 - (embedding <=> :embedding::vector) as score
                FROM {self.table_name}
                WHERE deleted_at IS NULL
            """

            # Add filters
            if filters:
                for key, value in filters.items():
                    # Filter by JSONB metadata
                    query += f" AND metadata->'{key}' = :filter_{key}"

            query += " ORDER BY embedding <=> :embedding::vector"
            query += f" LIMIT {limit}"

            # Execute query
            params = {"embedding": str(embedding)}
            if filters:
                for key, value in filters.items():
                    params[f"filter_{key}"] = str(value)

            result = await session.execute(text(query), params)
            rows = result.fetchall()

            return [
                SearchResult(
                    id=str(row[0]),
                    content=row[1],
                    metadata=row[2],
                    score=float(row[3]),
                )
                for row in rows
            ]

    async def upsert(
        self,
        id: str,
        embedding: list[float],
        content: str,
        metadata: dict[str, Any],
    ) -> None:
        """
        Insert or update vector.

        Uses PostgreSQL ON CONFLICT DO UPDATE.

        Args:
            id: Unique identifier
            embedding: Vector representation
            content: Original text
            metadata: Additional metadata
        """
        async with self.session_maker() as session:
            # TODO: Replace raw SQL with SQLAlchemy model in Week 4-6
            query = f"""
                INSERT INTO {self.table_name} (id, embedding, content, metadata, created_at)
                VALUES (:id, :embedding::vector, :content, :metadata::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    content = EXCLUDED.content,
                    metadata = EXCLUDED.metadata,
                    modified_at = NOW()
            """

            await session.execute(
                text(query),
                {
                    "id": id,
                    "embedding": str(embedding),
                    "content": content,
                    "metadata": metadata,
                },
            )
            await session.commit()

    async def delete(self, id: str) -> None:
        """
        Soft delete vector by ID.

        Sets deleted_at timestamp (RecordModel pattern).
        """
        async with self.session_maker() as session:
            # TODO: Replace raw SQL with SQLAlchemy model in Week 4-6
            query = f"""
                UPDATE {self.table_name}
                SET deleted_at = NOW()
                WHERE id = :id
            """

            await session.execute(text(query), {"id": id})
            await session.commit()

    async def hard_delete(self, id: str) -> None:
        """Hard delete vector (for testing/cleanup)."""
        async with self.session_maker() as session:
            query = f"DELETE FROM {self.table_name} WHERE id = :id"
            await session.execute(text(query), {"id": id})
            await session.commit()

    async def create_index(self, lists: int = 100, method: str = "ivfflat") -> None:
        """
        Create vector index for performance.

        Args:
            lists: Number of lists for ivfflat (100 for <10K, 1000 for 100K)
            method: Index method (ivfflat or hnsw)
        """
        async with self.session_maker() as session:
            index_name = f"{self.table_name}_embedding_idx"

            # Drop existing index
            await session.execute(text(f"DROP INDEX IF EXISTS {index_name}"))

            # Create new index
            if method == "ivfflat":
                query = f"""
                    CREATE INDEX {index_name}
                    ON {self.table_name}
                    USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = {lists})
                """
            elif method == "hnsw":
                # HNSW (Hierarchical Navigable Small World)
                # Better accuracy, slower build time
                query = f"""
                    CREATE INDEX {index_name}
                    ON {self.table_name}
                    USING hnsw (embedding vector_cosine_ops)
                """
            else:
                raise ValueError(f"Unknown index method: {method}")

            await session.execute(text(query))
            await session.commit()

    async def set_probes(self, probes: int = 10) -> None:
        """
        Set ivfflat.probes for query accuracy.

        Higher probes = more accurate but slower.
        - 1 probe: Fast but less accurate
        - 10 probes: Good balance (default)
        - 100 probes: Highest accuracy, slower
        """
        async with self.session_maker() as session:
            await session.execute(text(f"SET ivfflat.probes = {probes}"))


class ProductVectorStore:
    """
    Specialized vector store for products.

    Wraps PgvectorStore with product-specific logic.
    """

    def __init__(self, vector_store: VectorStore):
        """Initialize with vector store."""
        self.vector_store = vector_store

    async def search_products(
        self,
        query_embedding: list[float],
        limit: int = 5,
        organization_id: UUID | None = None,
        max_price: int | None = None,
        min_price: int | None = None,
        category: str | None = None,
    ) -> list[SearchResult]:
        """
        Search products with business logic filters.

        Args:
            query_embedding: Query vector
            limit: Max results
            organization_id: Filter by organization
            max_price: Max price in cents
            min_price: Min price in cents
            category: Filter by category

        Returns:
            List of SearchResult with product data
        """
        filters: dict[str, Any] = {}

        if organization_id:
            filters["organization_id"] = str(organization_id)

        if category:
            filters["category"] = category

        # TODO: Add price filters in Week 4-6
        # Price requires join with Product table or denormalization in metadata

        results = await self.vector_store.search(
            embedding=query_embedding,
            limit=limit,
            filters=filters,
        )

        # Post-filter by price if needed
        if max_price or min_price:
            filtered = []
            for result in results:
                price = result.metadata.get("price")
                if price:
                    if min_price and price < min_price:
                        continue
                    if max_price and price > max_price:
                        continue
                filtered.append(result)
            return filtered

        return results

    async def upsert_product(
        self,
        product_id: UUID,
        embedding: list[float],
        product_data: dict[str, Any],
    ) -> None:
        """
        Upsert product embedding.

        Args:
            product_id: Product ID
            embedding: Product embedding
            product_data: Product metadata (name, description, price, etc.)
        """
        # Prepare content for full-text search fallback
        content = f"{product_data.get('name', '')} {product_data.get('description', '')}"

        # Store metadata
        metadata = {
            "product_id": str(product_id),
            "organization_id": str(product_data.get("organization_id")),
            "name": product_data.get("name"),
            "price": product_data.get("price"),
            "category": product_data.get("category"),
        }

        await self.vector_store.upsert(
            id=str(product_id),
            embedding=embedding,
            content=content,
            metadata=metadata,
        )

    async def delete_product(self, product_id: UUID) -> None:
        """Delete product embedding."""
        await self.vector_store.delete(str(product_id))
