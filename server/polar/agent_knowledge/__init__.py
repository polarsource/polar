"""Agent Knowledge module - RAG and semantic search."""

from polar.agent_knowledge.base import (
    EmbeddingResult,
    EmbeddingService,
    SearchResult,
    VectorStore,
)
from polar.agent_knowledge.embedding_service import (
    OpenAIEmbeddingService,
    ProductEmbeddingGenerator,
)
from polar.agent_knowledge.service import KnowledgeService, get_knowledge_service
from polar.agent_knowledge.vector_store import (
    PgvectorStore,
    ProductVectorStore,
)

__all__ = [
    # Base classes
    "EmbeddingResult",
    "EmbeddingService",
    "SearchResult",
    "VectorStore",
    # Implementations
    "OpenAIEmbeddingService",
    "ProductEmbeddingGenerator",
    "PgvectorStore",
    "ProductVectorStore",
    # Service
    "KnowledgeService",
    "get_knowledge_service",
]
