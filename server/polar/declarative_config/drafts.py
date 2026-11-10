from uuid import UUID

from polar.benefit.repository import BenefitRepository
from polar.catalog.repository import CatalogBenefitRepository, CatalogProductRepository
from polar.models import Benefit, Catalog, Product
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository

from . import products
from .schemas import Config
from .validation import ProductChange

_INTERVAL_FIELDS = (
    "recurring_interval",
    "recurring_interval_count",
    "meter_interval",
    "meter_interval_count",
)


async def rows(
    session: AsyncSession, draft: Catalog, config: Config
) -> tuple[dict[str, Benefit], dict[str, Product]]:
    """The rows the draft created, by `external_id`. Applying to the draft
    again updates them in place."""
    benefits = await CatalogBenefitRepository.from_session(
        session
    ).get_benefits_by_external_ids(
        draft.id,
        [benefit.external_id for benefit in config.benefits],
        options=BenefitRepository.from_session(session).get_eager_options(),
    )
    draft_products = await CatalogProductRepository.from_session(
        session
    ).get_products_by_external_ids(
        draft.id,
        [product.external_id for product in config.products],
        options=ProductRepository.from_session(session).get_eager_options(),
    )
    return (
        {
            benefit.external_id: benefit
            for benefit in benefits
            if benefit.external_id is not None and benefit.catalog_id == draft.id
        },
        {
            product.external_id: product
            for product in draft_products
            if product.external_id is not None and product.catalog_id == draft.id
        },
    )


def keeps_intervals(
    change: ProductChange, draft_product: Product, meter_ids: dict[str, UUID]
) -> bool:
    """Whether the draft's row can take the config in place: a product's
    intervals can't be updated.

    A live product keeps its intervals, so its draft row must have them. A new
    product is compared with its create schema, which normalizes a meter cycle
    equal to the billing cycle to none, as the row stores it."""
    expected = (
        change.existing
        if change.existing is not None
        else products.product_create(change.config, None, meter_ids)
    )
    return all(
        getattr(draft_product, name) == getattr(expected, name, None)
        for name in _INTERVAL_FIELDS
    )
