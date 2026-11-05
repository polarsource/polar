import hashlib
import json
from collections.abc import Sequence
from typing import cast
from uuid import UUID

from pydantic import BaseModel

from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.meter_credit.properties import (
    BenefitMeterCreditProperties,
)
from polar.catalog.repository import CatalogRepository
from polar.catalog.service import CatalogEntries
from polar.catalog.service import catalog as catalog_service
from polar.models import Catalog, Organization
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .schemas import (
    ConfigBenefitMeterCredit,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigProductPriceMeteredTiers,
    ConfigProductPriceMeteredUnit,
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


def definitions(changes: ConfigChanges) -> CatalogEntries:
    """Fingerprint the products, benefits and meters this apply publishes as
    new rows."""
    return CatalogEntries(
        products={
            change.config.external_id: _fingerprint(change.config)
            for change in changes.products
            if _publishes_new_row(change)
        },
        benefits={
            change.config.external_id: _fingerprint(change.config)
            for change in changes.benefits
            if change.existing is None or change.update_dict
        },
        meters={
            change.config.external_id: _fingerprint(change.config)
            for change in changes.meters
            if change.existing is None or change.update_dict
        },
    )


async def cascade_meter_changes(
    session: AsyncReadSession,
    organization: Organization,
    changes: ConfigChanges,
    removed: Sequence[ConfigRemoval],
    *,
    catalog: Catalog | None = None,
) -> list[ConfigIssue]:
    """A changed meter gets a new row, and so does every meter credit benefit
    and every product billing it, so they point at the new row. Their diffs
    list the same meter `external_id`.

    Run before `cascade_benefit_changes`, so the products granting those
    benefits get a new row too. A current product or benefit the config
    doesn't describe can't get that new row, or stop using a meter that
    leaves the catalog, so it's an error.
    """
    changed = {
        change.config.external_id: change
        for change in changes.meters
        if change.existing is not None and change.update_dict
    }
    for benefit_change in changes.benefits:
        config = benefit_change.config
        if (
            benefit_change.existing is not None
            and "properties" not in benefit_change.update_dict
            and isinstance(config, ConfigBenefitMeterCredit)
            and config.properties.meter in changed
        ):
            benefit_change.update_dict["properties"] = config.properties.model_dump()
    for product_change in changes.products:
        if product_change.existing is None or "prices" in product_change.update_dict:
            continue
        if any(
            isinstance(
                price, (ConfigProductPriceMeteredUnit, ConfigProductPriceMeteredTiers)
            )
            and price.meter in changed
            for price in product_change.config.prices
        ):
            product_change.update_dict["prices"] = [
                price.model_dump() for price in product_change.config.prices
            ]

    affected: dict[UUID, tuple[str, Loc, str]] = {
        change.existing.id: (
            external_id,
            ["body", "meters", change.index],
            "Add it, so it uses the new version of the meter, or remove it.",
        )
        for external_id, change in changed.items()
        if change.existing is not None
    }
    removed_meters = {
        removal.external_id
        for removal in removed
        if removal.resource == ConfigResource.meter
    }
    if removed_meters:
        if catalog is None:
            catalog = await CatalogRepository.from_session(session).get_live(
                organization.id
            )
        for external_id, meter in (
            await catalog_service.get_catalog_meters(session, organization, catalog)
        ).items():
            if external_id in removed_meters:
                affected[meter.id] = (
                    external_id,
                    ["body", "meters"],
                    "Add it, or keep the meter in the config.",
                )
    if not affected:
        return []

    described_products = {change.config.external_id for change in changes.products}
    described_benefits = {change.config.external_id for change in changes.benefits}
    for removal in removed:
        if removal.resource == ConfigResource.product:
            described_products.add(removal.external_id)
        elif removal.resource == ConfigResource.benefit:
            described_benefits.add(removal.external_id)
    issues: list[ConfigIssue] = []
    for product, meter_id in await ProductRepository.from_session(
        session
    ).get_current_by_meters(organization.id, list(affected)):
        if product.external_id not in described_products:
            issues.append(
                _undescribed_reference(
                    ConfigResource.product,
                    product.external_id or product.name,
                    affected[meter_id],
                )
            )
    for benefit in await BenefitRepository.from_session(
        session
    ).get_current_meter_credits_by_meters(organization.id, list(affected)):
        if benefit.external_id not in described_benefits:
            issues.append(
                _undescribed_reference(
                    ConfigResource.benefit,
                    benefit.external_id or benefit.description,
                    affected[
                        UUID(
                            cast(BenefitMeterCreditProperties, benefit.properties)[
                                "meter_id"
                            ]
                        )
                    ],
                )
            )
    return issues


def _undescribed_reference(
    resource: ConfigResource, name: str, meter: tuple[str, Loc, str]
) -> ConfigIssue:
    external_id, loc, hint = meter
    return ConfigIssue(
        severity=ConfigIssueSeverity.error,
        type=ConfigIssueType.not_supported,
        loc=loc,
        msg=f"The {resource} {name!r} uses this meter but isn't in the config. {hint}",
        input=external_id,
    )


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
