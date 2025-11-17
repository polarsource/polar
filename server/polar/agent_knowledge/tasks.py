"""Background tasks for knowledge indexing (Dramatiq)."""

import structlog
from sqlalchemy import select

from polar.agent_knowledge.service import get_knowledge_service
from polar.kit.db.postgres import AsyncSessionMaker
from polar.models import Organization, Product
from polar.worker import JobContext, PolarWorkerContext, compute_backoff, task

logger = structlog.get_logger()


@task("agent_knowledge.index_product")
async def agent_knowledge_index_product(
    ctx: JobContext, product_id: str, polar_context: PolarWorkerContext
) -> None:
    """
    Index a single product for semantic search.

    Triggered when:
    - Product is created
    - Product is updated
    - Manual re-indexing is requested

    Args:
        ctx: Job context
        product_id: Product UUID
        polar_context: Polar worker context
    """
    async with AsyncSessionMaker() as session:
        from uuid import UUID

        # Get product
        product = await session.get(Product, UUID(product_id))
        if not product:
            logger.warning(f"Product not found for indexing: {product_id}")
            return

        logger.info(f"Indexing product: {product_id} ({product.name})")

        # Get knowledge service
        knowledge_service = get_knowledge_service(AsyncSessionMaker)

        # Index product
        await knowledge_service.index_product(session, product)

        logger.info(f"Product indexed successfully: {product_id}")


@task("agent_knowledge.index_organization_products")
async def agent_knowledge_index_organization_products(
    ctx: JobContext, organization_id: str, polar_context: PolarWorkerContext
) -> None:
    """
    Batch index all products for an organization.

    Triggered when:
    - Organization onboarding
    - Manual re-indexing requested
    - Schema changes

    Args:
        ctx: Job context
        organization_id: Organization UUID
        polar_context: Polar worker context
    """
    async with AsyncSessionMaker() as session:
        from uuid import UUID

        # Get organization
        organization = await session.get(Organization, UUID(organization_id))
        if not organization:
            logger.warning(
                f"Organization not found for indexing: {organization_id}"
            )
            return

        logger.info(
            f"Starting batch product indexing for organization: {organization_id} ({organization.name})"
        )

        # Get knowledge service
        knowledge_service = get_knowledge_service(AsyncSessionMaker)

        # Batch index products
        count = await knowledge_service.index_products_batch(
            session, UUID(organization_id)
        )

        logger.info(
            f"Batch indexing complete: {count} products indexed for {organization_id}"
        )


@task("agent_knowledge.rebuild_index")
async def agent_knowledge_rebuild_index(
    ctx: JobContext, polar_context: PolarWorkerContext
) -> None:
    """
    Rebuild entire product index (all organizations).

    Triggered when:
    - Embedding model changes
    - Schema migration
    - Index corruption

    WARNING: This is an expensive operation. Use sparingly.

    Args:
        ctx: Job context
        polar_context: Polar worker context
    """
    async with AsyncSessionMaker() as session:
        logger.info("Starting full index rebuild")

        # Get all organizations
        statement = select(Organization).where(Organization.deleted_at.is_(None))
        result = await session.execute(statement)
        organizations = list(result.scalars().all())

        logger.info(f"Rebuilding index for {len(organizations)} organizations")

        # Index each organization's products
        total_products = 0
        knowledge_service = get_knowledge_service(AsyncSessionMaker)

        for org in organizations:
            try:
                count = await knowledge_service.index_products_batch(
                    session, org.id
                )
                total_products += count
                logger.info(f"Indexed {count} products for {org.name}")
            except Exception as e:
                logger.error(
                    f"Error indexing organization {org.id}: {e}", exc_info=True
                )

        logger.info(
            f"Full index rebuild complete: {total_products} products indexed"
        )
