from polar.catalog.repository import CatalogProductRepository, CatalogRepository
from polar.catalog.service import catalog as catalog_service
from polar.models import Catalog, Organization
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .export import export_config
from .schemas import (
    Config,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigRemoval,
    ConfigRemovalReason,
    ConfigResource,
)


async def products(
    session: AsyncReadSession,
    organization: Organization,
    config: Config,
    *,
    catalog: Catalog | None = None,
) -> tuple[list[ConfigRemoval], list[ConfigIssue]]:
    """Products of the live catalog, or of `catalog` when given, that the config
    deprecates or doesn't list.

    Products that pull doesn't export are left untouched.
    A product that isn't listed but is still in use must be marked deprecated
    instead.
    """
    if "products" not in config.model_fields_set:
        return [], []
    if catalog is None:
        catalog = await CatalogRepository.from_session(session).get_live(
            organization.id
        )
        _, entries = await catalog_service.get_live_entries(
            session, organization, catalog
        )
        external_ids = set(entries)
    else:
        external_ids = await CatalogProductRepository.from_session(
            session
        ).get_external_ids(catalog.id)
    listed = {product.external_id for product in config.products}
    deprecated = {
        product.external_id for product in config.products if product.deprecated
    }
    missing = sorted(external_ids - listed)
    if missing:
        exported = await export_config(session, organization, catalog)
        describable = {product.external_id for product in exported.config.products}
        missing = [external_id for external_id in missing if external_id in describable]
    in_use = await ProductRepository.from_session(session).get_external_ids_in_use(
        organization.id, missing
    )
    removed = [
        ConfigRemoval(
            resource=ConfigResource.product,
            external_id=external_id,
            reason=ConfigRemovalReason.deprecated,
        )
        for external_id in sorted(external_ids & deprecated)
    ] + [
        ConfigRemoval(
            resource=ConfigResource.product,
            external_id=external_id,
            reason=ConfigRemovalReason.missing,
        )
        for external_id in missing
        if external_id not in in_use
    ]
    issues = [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.removed_in_use,
            loc=["body", "products"],
            msg=(
                f'Product "{external_id}" still has subscriptions, or a '
                "scheduled subscription change to it, so it can't be removed. "
                "Keep it in the config and mark it deprecated instead."
            ),
            input=external_id,
        )
        for external_id in missing
        if external_id in in_use
    ]
    return removed, issues


async def benefits(
    session: AsyncReadSession,
    organization: Organization,
    config: Config,
    *,
    catalog: Catalog | None = None,
) -> list[ConfigRemoval]:
    """Benefits of the live catalog, or of `catalog` when given, that the config
    deprecates or doesn't list.

    Benefits that pull doesn't export are left untouched. Grants keep their
    row, so a benefit customers still have can leave the catalog.
    """
    if "benefits" not in config.model_fields_set:
        return []
    if catalog is None:
        catalog = await CatalogRepository.from_session(session).get_live(
            organization.id
        )
    live_benefits = await catalog_service.get_catalog_benefits(
        session, organization, catalog
    )
    listed = {benefit.external_id for benefit in config.benefits}
    deprecated = {
        benefit.external_id for benefit in config.benefits if benefit.deprecated
    }
    missing = sorted(live_benefits.keys() - listed)
    if missing:
        exported = await export_config(session, organization, catalog)
        describable = {benefit.external_id for benefit in exported.config.benefits}
        missing = [external_id for external_id in missing if external_id in describable]
    return [
        ConfigRemoval(
            resource=ConfigResource.benefit,
            external_id=external_id,
            reason=ConfigRemovalReason.deprecated,
        )
        for external_id in sorted(live_benefits.keys() & deprecated)
    ] + [
        ConfigRemoval(
            resource=ConfigResource.benefit,
            external_id=external_id,
            reason=ConfigRemovalReason.missing,
        )
        for external_id in missing
    ]
