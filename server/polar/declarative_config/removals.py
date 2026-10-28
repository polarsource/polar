from polar.catalog.repository import CatalogRepository
from polar.catalog.service import catalog as catalog_service
from polar.models import Organization
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
    session: AsyncReadSession, organization: Organization, config: Config
) -> tuple[list[ConfigRemoval], list[ConfigIssue]]:
    """Live products the config deprecates or doesn't list.

    Products that pull doesn't export are left untouched.
    A product that isn't listed but is still in use must be marked deprecated
    instead.
    """
    if "products" not in config.model_fields_set:
        return [], []
    live = await CatalogRepository.from_session(session).get_live(organization.id)
    _, entries = await catalog_service.get_live_entries(session, organization, live)
    listed = {product.external_id for product in config.products}
    deprecated = {
        product.external_id for product in config.products if product.deprecated
    }
    missing = sorted(entries.keys() - listed)
    if missing:
        exported = await export_config(session, organization)
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
        for external_id in sorted(entries.keys() & deprecated)
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
                f'Product "{external_id}" still has active subscriptions, '
                "so it can't be removed. Keep it in the config and mark it "
                "deprecated instead."
            ),
            input=external_id,
        )
        for external_id in missing
        if external_id in in_use
    ]
    return removed, issues
