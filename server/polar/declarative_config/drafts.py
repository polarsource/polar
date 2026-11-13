from collections import defaultdict
from uuid import uuid4

from polar.benefit.repository import BenefitRepository
from polar.catalog.repository import (
    CatalogBenefitRepository,
    CatalogMeterRepository,
    CatalogProductRepository,
)
from polar.catalog.service import CatalogMembers
from polar.models import Catalog, Product
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository

from . import products
from .validation import ConfigChanges, ProductChange

_INTERVAL_FIELDS = (
    "recurring_interval",
    "recurring_interval_count",
    "meter_interval",
    "meter_interval_count",
)


def _keeps_intervals(change: ProductChange, draft_product: Product) -> bool:
    """Whether the draft's row can take the config in place: a product's
    intervals can't be updated.

    A live product keeps its intervals, so its draft row must have them. A new
    product is compared with its create schema, which normalizes a meter cycle
    equal to the billing cycle to none, as the row stores it."""
    expected = (
        change.existing
        if change.existing is not None
        else products.product_create(change.config, None, defaultdict(uuid4))
    )
    return all(
        getattr(draft_product, name) == getattr(expected, name, None)
        for name in _INTERVAL_FIELDS
    )


async def rows(
    session: AsyncSession, draft: Catalog, changes: ConfigChanges
) -> CatalogMembers:
    """The rows the draft created, by `external_id`. Applying to the draft
    again updates them in place."""
    benefits = await CatalogBenefitRepository.from_session(
        session
    ).get_benefits_by_external_ids(
        draft.id,
        [change.config.external_id for change in changes.benefits],
        options=BenefitRepository.from_session(session).get_eager_options(),
    )
    product_changes = {change.config.external_id: change for change in changes.products}
    draft_products = await CatalogProductRepository.from_session(
        session
    ).get_products_by_external_ids(
        draft.id,
        list(product_changes),
        options=ProductRepository.from_session(session).get_eager_options(),
    )
    meter_external_ids = {change.config.external_id for change in changes.meters}
    return CatalogMembers(
        products={
            product.external_id: product
            for product in draft_products
            if product.external_id is not None
            and product.catalog_id == draft.id
            and _keeps_intervals(product_changes[product.external_id], product)
        },
        benefits={
            benefit.external_id: benefit
            for benefit in benefits
            if benefit.external_id is not None and benefit.catalog_id == draft.id
        },
        meters={
            member.external_id: member.meter
            for member in await CatalogMeterRepository.from_session(
                session
            ).get_all_by_catalog(draft.id)
            if member.external_id in meter_external_ids
            and member.meter.catalog_id == draft.id
        },
    )
