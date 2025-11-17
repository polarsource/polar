"""Embedding service using OpenAI API."""

import hashlib
from typing import Any

from polar.agent_knowledge.base import EmbeddingResult, EmbeddingService
from polar.config import settings
from polar.redis import Redis


class OpenAIEmbeddingService(EmbeddingService):
    """
    Embedding service using OpenAI text-embedding-3-small.

    Features:
    - 1536 dimensions
    - $0.02 per 1M tokens (~$0.20 for 10K products)
    - Redis caching (1 hour TTL)
    """

    def __init__(
        self,
        model: str = "text-embedding-3-small",
        dimensions: int = 1536,
        cache_ttl: int = 3600,
    ):
        """
        Initialize embedding service.

        Args:
            model: OpenAI embedding model
            dimensions: Embedding dimensions
            cache_ttl: Cache TTL in seconds (default 1 hour)
        """
        self.model = model
        self.dimensions = dimensions
        self.cache_ttl = cache_ttl
        self.redis = Redis()

        # TODO: Initialize OpenAI client in Week 2-3
        # from openai import AsyncOpenAI
        # self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def embed(self, text: str) -> EmbeddingResult:
        """
        Generate embedding for text with caching.

        Args:
            text: Input text to embed

        Returns:
            EmbeddingResult with 1536-dim vector
        """
        # Check cache first
        cache_key = self._cache_key(text)
        cached = await self._get_cached(cache_key)
        if cached:
            return EmbeddingResult(
                embedding=cached,
                model=self.model,
                dimensions=self.dimensions,
            )

        # Generate embedding with OpenAI
        from polar.agent_llm.openai_client import OpenAIClient

        openai_client = OpenAIClient()
        embedding = await openai_client.embed(text, model=self.model)

        # Cache result
        await self._set_cached(cache_key, embedding)

        return EmbeddingResult(
            embedding=embedding,
            model=self.model,
            dimensions=self.dimensions,
        )

    async def embed_batch(self, texts: list[str]) -> list[EmbeddingResult]:
        """
        Generate embeddings for multiple texts (batched for efficiency).

        OpenAI allows up to 2048 inputs per batch.

        Args:
            texts: List of input texts

        Returns:
            List of EmbeddingResult in same order as input
        """
        if not texts:
            return []

        # Check cache for all texts
        results: list[EmbeddingResult | None] = [None] * len(texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, text in enumerate(texts):
            cache_key = self._cache_key(text)
            cached = await self._get_cached(cache_key)
            if cached:
                results[i] = EmbeddingResult(
                    embedding=cached,
                    model=self.model,
                    dimensions=self.dimensions,
                )
            else:
                uncached_indices.append(i)
                uncached_texts.append(text)

        # Generate embeddings for uncached texts
        if uncached_texts:
            # Batch embed with OpenAI
            from polar.agent_llm.openai_client import OpenAIClient

            openai_client = OpenAIClient()
            embeddings = await openai_client.embed_batch(uncached_texts, model=self.model)

            # Cache and populate results
            for i, embedding in zip(uncached_indices, embeddings):
                cache_key = self._cache_key(texts[i])
                await self._set_cached(cache_key, embedding)
                results[i] = EmbeddingResult(
                    embedding=embedding,
                    model=self.model,
                    dimensions=self.dimensions,
                )

        return results  # type: ignore

    def _cache_key(self, text: str) -> str:
        """Generate cache key for text."""
        text_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        return f"embedding:{self.model}:{text_hash}"

    async def _get_cached(self, key: str) -> list[float] | None:
        """Get embedding from cache."""
        cached = await self.redis.get(key)
        if cached:
            # Parse JSON string back to list
            import json

            return json.loads(cached)
        return None

    async def _set_cached(self, key: str, embedding: list[float]) -> None:
        """Set embedding in cache."""
        import json

        await self.redis.set(key, json.dumps(embedding), ex=self.cache_ttl)


class ProductEmbeddingGenerator:
    """
    Generates embeddings specifically for products.

    Combines: name + description + category + attributes
    """

    def __init__(self, embedding_service: EmbeddingService):
        """Initialize with embedding service."""
        self.embedding_service = embedding_service

    def prepare_product_text(self, product: Any) -> str:
        """
        Prepare product for embedding.

        Format:
        Name: {name}
        Description: {description}
        Category: {category}
        Price: ${price}
        """
        parts = [f"Name: {product.name}"]

        if product.description:
            parts.append(f"Description: {product.description}")

        # TODO: Add category when Product model has it
        # if product.category:
        #     parts.append(f"Category: {product.category}")

        # TODO: Add price from ProductPrice relationship
        # if product.price:
        #     parts.append(f"Price: ${product.price / 100}")

        return "\n".join(parts)

    async def generate_for_product(self, product: Any) -> EmbeddingResult:
        """Generate embedding for product."""
        text = self.prepare_product_text(product)
        return await self.embedding_service.embed(text)

    async def generate_for_products(self, products: list[Any]) -> list[EmbeddingResult]:
        """Generate embeddings for multiple products (batched)."""
        texts = [self.prepare_product_text(p) for p in products]
        return await self.embedding_service.embed_batch(texts)
