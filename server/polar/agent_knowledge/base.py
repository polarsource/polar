"""Base classes for agent knowledge system (RAG)."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class SearchResult:
    """Result from vector search."""

    id: str
    content: str
    metadata: dict[str, Any]
    score: float  # Similarity score (cosine distance)


@dataclass
class EmbeddingResult:
    """Result from embedding generation."""

    embedding: list[float]
    model: str
    dimensions: int


class VectorStore(ABC):
    """
    Abstract interface for vector storage.

    Implementations:
    - PgvectorStore (Week 4-6): PostgreSQL pgvector extension
    - PineconeStore (future): Pinecone managed service
    """

    @abstractmethod
    async def search(
        self,
        embedding: list[float],
        limit: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """
        Search for similar vectors.

        Args:
            embedding: Query vector
            limit: Max results to return
            filters: Metadata filters (price, category, etc.)

        Returns:
            List of SearchResult ordered by similarity
        """
        pass

    @abstractmethod
    async def upsert(
        self,
        id: str,
        embedding: list[float],
        content: str,
        metadata: dict[str, Any],
    ) -> None:
        """
        Insert or update vector.

        Args:
            id: Unique identifier
            embedding: Vector representation
            content: Original text content
            metadata: Additional metadata (product_id, category, etc.)
        """
        pass

    @abstractmethod
    async def delete(self, id: str) -> None:
        """Delete vector by ID."""
        pass


class EmbeddingService(ABC):
    """
    Abstract interface for embedding generation.

    Implementations:
    - OpenAIEmbeddingService (Week 2-3): OpenAI text-embedding-3-small
    - LocalEmbeddingService (future): Sentence-BERT local model
    """

    @abstractmethod
    async def embed(self, text: str) -> EmbeddingResult:
        """
        Generate embedding for text.

        Args:
            text: Input text to embed

        Returns:
            EmbeddingResult with vector and metadata
        """
        pass

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[EmbeddingResult]:
        """
        Generate embeddings for multiple texts (batched for efficiency).

        Args:
            texts: List of input texts

        Returns:
            List of EmbeddingResult in same order as input
        """
        pass
