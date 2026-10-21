import hashlib
import json
from collections.abc import Mapping, Sequence

from polar.catalog.repository import CatalogRepository
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.discount.repository import DiscountRepository
from polar.models import Product
from polar.postgres import AsyncReadSession, AsyncSession

from .schemas import (
    ConfigChange,
    ConfigFieldChange,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
)
from .validation import ConfigChanges, ProductChange


def _publishes_new_row(change: ProductChange) -> bool:
    return change.existing is None or bool(
        change.update_dict and not change.existing.is_archived
    )


def product_definitions(changes: ConfigChanges) -> dict[str, str]:
    """Fingerprint the products this apply publishes as new rows, by external_id."""
    return {
        change.config.external_id: hashlib.sha256(
            json.dumps(change.config.model_dump(mode="json"), sort_keys=True).encode()
        ).hexdigest()
        for change in changes.products
        if _publishes_new_row(change)
    }


def benefit_issues(changes: ConfigChanges) -> list[ConfigIssue]:
    """Benefits aren't versioned yet, so their definitions can't change."""
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.not_supported,
            loc=["body", "benefits", change.index],
            msg=(
                "Benefits can't be changed yet for organizations using catalog "
                "versioning."
            ),
            input=change.config.external_id,
        )
        for change in changes.benefits
        if change.existing is not None and change.update_dict
    ]


async def add_catalog_diffs(
    session: AsyncReadSession,
    product_changes: Sequence[ConfigChange],
    changes: Sequence[ProductChange],
    catalog_before: str | None,
    catalog_after: str,
) -> None:
    hashes = await CatalogRepository.from_session(session).get_hashes(
        [
            change.existing.catalog_id
            for change in changes
            if change.existing is not None and change.existing.catalog_id is not None
        ]
    )
    for product_change, change in zip(product_changes, changes, strict=True):
        if change.existing is not None and _publishes_new_row(change):
            product_change.diff.append(
                ConfigFieldChange(
                    field="catalog",
                    before=hashes.get(change.existing.catalog_id, catalog_before)
                    if change.existing.catalog_id is not None
                    else catalog_before,
                    after=catalog_after,
                )
            )


async def carry_over_references(
    session: AsyncSession,
    changes: Sequence[ProductChange],
    new_products: Mapping[str, Product],
) -> None:
    """Point checkout links at the new version, and extend discount restrictions
    to it: the old version stays billable for existing subscriptions."""
    checkout_link_repository = CheckoutLinkRepository.from_session(session)
    discount_repository = DiscountRepository.from_session(session)
    for change in changes:
        new_product = new_products.get(change.config.external_id)
        if change.existing is not None and new_product is not None:
            await checkout_link_repository.replace_product(
                change.existing.id, new_product.id
            )
            await discount_repository.add_product(change.existing.id, new_product.id)
