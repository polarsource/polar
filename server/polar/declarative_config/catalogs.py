import hashlib
import json
from collections.abc import Mapping, Sequence
from uuid import UUID

from pydantic import BaseModel

from polar.catalog.repository import CatalogRepository
from polar.catalog.service import benefit_entry_key
from polar.catalog.service import catalog as catalog_service
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.discount.repository import DiscountRepository
from polar.models import Organization, Product
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository

from .schemas import (
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigRemoval,
    ConfigResource,
)
from .validation import ConfigChanges, Loc, ProductChange


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
    session: AsyncReadSession,
    organization: Organization,
    changes: ConfigChanges,
    removed: Sequence[ConfigRemoval],
) -> list[ConfigIssue]:
    """A changed benefit gets a new row, and so does every product granting it:
    the benefit links are part of the product. Its `benefits` diff lists the
    same `external_id`s, now pointing at their new rows.

    A current product the config doesn't describe can't get that new row, or
    stop granting a benefit that leaves the catalog, so it's an error.
    """
    changed = {
        change.config.external_id: change
        for change in changes.benefits
        if change.existing is not None and change.update_dict
    }
    for change in changes.products:
        if change.existing is None or "benefits" in change.update_dict:
            continue
        if any(
            external_id in changed and external_id in change.before["benefits"]
            for external_id in change.config.benefits
        ):
            change.update_dict["benefits"] = list(change.config.benefits)

    removed_benefits = {
        removal.external_id
        for removal in removed
        if removal.resource == ConfigResource.benefit
    }
    affected: dict[UUID, tuple[str, Loc, str]] = {
        change.existing.id: (
            external_id,
            ["body", "benefits", change.index],
            "Add it, so it gets the new version of the benefit, or remove it.",
        )
        for external_id, change in changed.items()
        if change.existing is not None
    }
    if removed_benefits:
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        for external_id, benefit in (
            await catalog_service.get_catalog_benefits(session, organization, live)
        ).items():
            if external_id in removed_benefits:
                affected[benefit.id] = (
                    external_id,
                    ["body", "benefits"],
                    "Add it, or keep the benefit in the config.",
                )
    if not affected:
        return []

    described = {change.config.external_id for change in changes.products} | {
        removal.external_id
        for removal in removed
        if removal.resource == ConfigResource.product
    }
    issues: list[ConfigIssue] = []
    for product in await ProductRepository.from_session(
        session
    ).get_current_by_benefits(organization.id, list(affected)):
        if product.external_id in described:
            continue
        for benefit in product.benefits:
            if benefit.id not in affected:
                continue
            external_id, loc, hint = affected[benefit.id]
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.not_supported,
                    loc=loc,
                    msg=(
                        f"The product {product.external_id or product.name!r} "
                        f"grants this benefit but isn't in the config. {hint}"
                    ),
                    input=external_id,
                )
            )
    return issues


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
