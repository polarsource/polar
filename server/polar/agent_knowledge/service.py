"""Knowledge service for RAG (Retrieval-Augmented Generation)."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent_knowledge.base import SearchResult
from polar.agent_knowledge.embedding_service import (
    OpenAIEmbeddingService,
    ProductEmbeddingGenerator,
)
from polar.agent_knowledge.vector_store import ProductVectorStore, PgvectorStore
from polar.kit.db.postgres import AsyncSessionMaker
from polar.models import Product


class KnowledgeService:
    """
    Knowledge service for semantic search and RAG.

    Workflow:
    1. Embed query using OpenAI
    2. Search vector store (pgvector)
    3. Return relevant products/documents

    Week 4-6: Full implementation with RAG
    Week 1-3: Basic setup and testing
    """

    def __init__(
        self,
        session_maker: AsyncSessionMaker,
        embedding_service: OpenAIEmbeddingService | None = None,
        vector_store: PgvectorStore | None = None,
    ):
        """
        Initialize knowledge service.

        Args:
            session_maker: SQLAlchemy async session maker
            embedding_service: OpenAI embedding service
            vector_store: pgvector store
        """
        self.session_maker = session_maker
        self.embedding_service = embedding_service or OpenAIEmbeddingService()
        self.vector_store = vector_store or PgvectorStore(session_maker)
        self.product_vector_store = ProductVectorStore(self.vector_store)
        self.product_embedding_generator = ProductEmbeddingGenerator(
            self.embedding_service
        )

    async def search_products(
        self,
        query: str,
        organization_id: UUID,
        limit: int = 5,
        max_price: int | None = None,
        min_price: int | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Semantic product search using RAG.

        Args:
            query: Natural language search query
            organization_id: Organization ID
            limit: Max results
            max_price: Max price in cents
            min_price: Min price in cents
            category: Filter by category

        Returns:
            List of products with relevance scores
        """
        # 1. Embed query
        embedding_result = await self.embedding_service.embed(query)

        # 2. Search vector store
        results = await self.product_vector_store.search_products(
            query_embedding=embedding_result.embedding,
            limit=limit,
            organization_id=organization_id,
            max_price=max_price,
            min_price=min_price,
            category=category,
        )

        # 3. Hydrate with full product data
        products = []
        async with self.session_maker() as session:
            for result in results:
                product_id = UUID(result.metadata["product_id"])
                product = await session.get(Product, product_id)
                if product:
                    products.append(
                        {
                            "id": str(product.id),
                            "name": product.name,
                            "description": product.description,
                            "score": result.score,
                            # Add more fields as needed
                        }
                    )

        return products

    async def index_product(
        self, session: AsyncSession, product: Product
    ) -> None:
        """
        Index product for semantic search.

        Called when:
        - Product is created
        - Product is updated
        - Batch indexing is triggered

        Args:
            session: Database session
            product: Product to index
        """
        # 1. Generate embedding
        embedding_result = await self.product_embedding_generator.generate_for_product(
            product
        )

        # 2. Prepare metadata
        product_data = {
            "product_id": product.id,
            "organization_id": product.organization_id,
            "name": product.name,
            "description": product.description,
            # TODO: Add category when Product model has it
            # "category": product.category,
            # TODO: Add price from ProductPrice relationship
            # "price": product.default_price_amount,
        }

        # 3. Upsert to vector store
        await self.product_vector_store.upsert_product(
            product_id=product.id,
            embedding=embedding_result.embedding,
            product_data=product_data,
        )

    async def index_products_batch(
        self, session: AsyncSession, organization_id: UUID
    ) -> int:
        """
        Batch index all products for organization.

        Used for:
        - Initial setup
        - Re-indexing after schema changes
        - Periodic refresh

        Args:
            session: Database session
            organization_id: Organization ID

        Returns:
            Number of products indexed
        """
        # 1. Fetch all products
        statement = select(Product).where(
            Product.organization_id == organization_id,
            Product.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        products = list(result.scalars().all())

        if not products:
            return 0

        # 2. Generate embeddings (batched)
        embedding_results = (
            await self.product_embedding_generator.generate_for_products(products)
        )

        # 3. Upsert to vector store (batched)
        for product, embedding_result in zip(products, embedding_results):
            product_data = {
                "product_id": product.id,
                "organization_id": product.organization_id,
                "name": product.name,
                "description": product.description,
            }

            await self.product_vector_store.upsert_product(
                product_id=product.id,
                embedding=embedding_result.embedding,
                product_data=product_data,
            )

        return len(products)

    async def delete_product(self, product_id: UUID) -> None:
        """
        Remove product from search index.

        Called when product is deleted.

        Args:
            product_id: Product ID
        """
        await self.product_vector_store.delete_product(product_id)

    async def get_context_for_query(
        self,
        query: str,
        organization_id: UUID,
        top_k: int = 3,
    ) -> str:
        """
        Get relevant context for LLM prompt (RAG).

        Args:
            query: User query
            organization_id: Organization ID
            top_k: Number of relevant products to retrieve

        Returns:
            Formatted context string for LLM prompt
        """
        products = await self.search_products(
            query=query,
            organization_id=organization_id,
            limit=top_k,
        )

        if not products:
            return "No relevant products found."

        # Format context for LLM
        context_parts = ["Here are the most relevant products:"]
        for i, product in enumerate(products, 1):
            context_parts.append(
                f"\n{i}. {product['name']}\n"
                f"   Description: {product.get('description', 'N/A')}\n"
                f"   Relevance: {product['score']:.2f}"
            )

        return "\n".join(context_parts)


# Global knowledge service instance
# TODO: Initialize properly with DI in Week 4-6
knowledge_service: KnowledgeService | None = None


def get_knowledge_service(session_maker: AsyncSessionMaker) -> KnowledgeService:
    """Get or create knowledge service singleton."""
    global knowledge_service
    if knowledge_service is None:
        knowledge_service = KnowledgeService(session_maker)
    return knowledge_service
