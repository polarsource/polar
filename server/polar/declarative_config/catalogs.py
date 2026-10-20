from collections.abc import Mapping, Sequence

from polar.catalog.service import catalog as catalog_service
from polar.models import Product
from polar.postgres import AsyncSession

from .schemas import ConfigChange, ConfigFieldChange
from .validation import ConfigChanges, ProductChange


def catalog_after(base: int, changes: ConfigChanges) -> int:
    if any(
        change.existing is None
        or (change.update_dict and not change.existing.is_archived)
        for change in changes.products
    ):
        return base + 1
    return base


def add_version_diffs(
    product_changes: Sequence[ConfigChange],
    changes: Sequence[ProductChange],
    catalog_before: int | None,
    catalog_after: int,
) -> None:
    for product_change, change in zip(product_changes, changes, strict=True):
        if (
            change.existing is not None
            and change.update_dict
            and not change.existing.is_archived
        ):
            product_change.diff.append(
                ConfigFieldChange(
                    field="version",
                    before=change.existing.version or catalog_before,
                    after=catalog_after,
                )
            )


async def carry_over_references(
    session: AsyncSession,
    changes: Sequence[ProductChange],
    new_products: Mapping[str, Product],
) -> None:
    await catalog_service.carry_over_references(
        session,
        {
            change.existing.id: new_products[change.config.external_id].id
            for change in changes
            if change.existing is not None and change.config.external_id in new_products
        },
    )
