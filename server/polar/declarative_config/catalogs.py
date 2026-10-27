import hashlib
import json
from collections.abc import Mapping, Sequence

from pydantic import BaseModel

from polar.catalog.service import benefit_entry_key
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.discount.repository import DiscountRepository
from polar.models import Organization, Product
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository

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


def _fingerprint(config: BaseModel) -> str:
    return hashlib.sha256(
        json.dumps(config.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()


def definitions(changes: ConfigChanges) -> dict[str, str]:
    """Fingerprint the products and benefits this apply publishes as new rows."""
    return {
        **{
            change.config.external_id: _fingerprint(change.config)
            for change in changes.products
            if _publishes_new_row(change)
        },
        **{
            benefit_entry_key(change.config.external_id): _fingerprint(change.config)
            for change in changes.benefits
            if change.existing is None or change.update_dict
        },
    }


async def cascade_benefit_changes(
    session: AsyncSession, organization: Organization, changes: ConfigChanges
) -> list[ConfigIssue]:
    """A changed benefit gets a new row, and so does every product granting it:
    the benefit links are part of the product.

    A current product left out of the config can't get its new row, so it's an
    error, instead of a live product granting a previous benefit version.
    """
    changed = {
        change.config.external_id: change
        for change in changes.benefits
        if change.existing is not None and change.update_dict
    }
    if not changed:
        return []

    for change in changes.products:
        if change.existing is None:
            continue
        granted = [
            external_id
            for external_id in change.config.benefits
            if external_id in changed and external_id in change.before["benefits"]
        ]
        if granted:
            change.update_dict["changed_benefits"] = granted
            change.before["changed_benefits"] = []

    listed = {change.config.external_id for change in changes.products}
    benefit_external_ids = {
        change.existing.id: external_id
        for external_id, change in changed.items()
        if change.existing is not None
    }
    issues: list[ConfigIssue] = []
    for product in await ProductRepository.from_session(
        session
    ).get_current_by_benefits(organization.id, list(benefit_external_ids)):
        if product.external_id in listed:
            continue
        for benefit in product.benefits:
            external_id = benefit_external_ids.get(benefit.id)
            if external_id is None:
                continue
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.not_supported,
                    loc=["body", "benefits", changed[external_id].index],
                    msg=(
                        f"The product {product.external_id or product.name!r} "
                        "grants this benefit but isn't in the config. Add it, "
                        "so it gets the new version of the benefit."
                    ),
                    input=external_id,
                )
            )
    return issues


def add_catalog_diffs(
    product_changes: Sequence[ConfigChange],
    changes: Sequence[ProductChange],
    catalog_before: str | None,
    catalog_after: str,
) -> None:
    for product_change, change in zip(product_changes, changes, strict=True):
        if _publishes_new_row(change):
            product_change.diff.append(
                ConfigFieldChange(
                    field="catalog",
                    before=catalog_before,
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
