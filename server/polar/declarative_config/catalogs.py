from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from polar.catalog.repository import CatalogMigrationRepository, CatalogRepository
from polar.catalog.service import catalog as catalog_service
from polar.models import Catalog, Organization, Product
from polar.postgres import AsyncReadSession, AsyncSession

from .schemas import (
    Config,
    ConfigAction,
    ConfigChange,
    ConfigFieldChange,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigMigration,
    ConfigResource,
    ConfigResult,
)
from .validation import ConfigChanges, ProductChange


@dataclass
class MigrationCheck:
    config: ConfigMigration
    action: ConfigAction
    subscriptions: int


def catalog_after(base: int, changes: ConfigChanges) -> int:
    if any(
        change.existing is None
        or (change.update_dict and not change.existing.is_archived)
        for change in changes.products
    ):
        return base + 1
    return base


async def running_migration_issues(
    session: AsyncReadSession, organization: Organization, changes: ConfigChanges
) -> list[ConfigIssue]:
    """Block changes to a product that a running migration is moving customers to."""
    running = {
        migration.target_external_id: migration
        for migration in await CatalogMigrationRepository.from_session(
            session
        ).get_all_open(organization.id)
    }
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.migration_running,
            loc=["body", "products", change.index],
            msg=(
                f"Migration {running[change.config.external_id].external_id} is "
                "still moving customers to this product. Wait for it to finish."
            ),
            input=change.config.external_id,
        )
        for change in changes.products
        if change.existing is not None
        and change.update_dict
        and change.config.external_id in running
    ]


async def check_migrations(
    session: AsyncReadSession,
    organization: Organization,
    config: Config,
    changes: ConfigChanges,
    catalog_after: int | None,
) -> tuple[list[MigrationCheck], list[ConfigIssue]]:
    if not config.migrations:
        return [], []
    if catalog_after is None:
        return [], [
            ConfigIssue(
                severity=ConfigIssueSeverity.error,
                type=ConfigIssueType.not_supported,
                loc=["body", "migrations"],
                msg="Migrations need catalog versioning, which isn't enabled.",
                input=None,
            )
        ]

    product_changes = {change.config.external_id: change for change in changes.products}
    live_product_ids = await catalog_service.get_live_product_ids(session, organization)
    repository = CatalogMigrationRepository.from_session(session)
    issues: list[ConfigIssue] = []
    checks: list[MigrationCheck] = []
    seen_sources: set[str] = set()
    for index, migration in enumerate(config.migrations):
        loc: list[str | int] = ["body", "migrations", index]
        if migration.subscriptions_of in seen_sources:
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.duplicate_migration_source,
                    loc=[*loc, "subscriptions_of"],
                    msg=(
                        "Two migrations in the same apply can't move "
                        "the same subscriptions."
                    ),
                    input=migration.subscriptions_of,
                )
            )
            continue
        seen_sources.add(migration.subscriptions_of)

        existing = await repository.get_by_external_id(
            organization.id, migration.external_id
        )
        if existing is not None:
            existing_catalog = await CatalogRepository.from_session(session).get_by_id(
                existing.catalog_id
            )
            assert existing_catalog is not None
            if (
                existing_catalog.version != migration.to_catalog
                or existing.source_external_id != migration.subscriptions_of
                or existing.target_external_id != migration.target_external_id
            ):
                issues.append(
                    ConfigIssue(
                        severity=ConfigIssueSeverity.error,
                        type=ConfigIssueType.migration_changed,
                        loc=loc,
                        msg=(
                            "This migration was already applied with a "
                            "different definition. Use a new external_id."
                        ),
                        input=migration.external_id,
                    )
                )
                continue
            checks.append(
                MigrationCheck(
                    migration, ConfigAction.unchanged, existing.subscriptions_count
                )
            )
            continue

        running = await repository.get_open_by_source(
            organization.id, migration.subscriptions_of
        )
        if running is not None:
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.migration_running,
                    loc=[*loc, "subscriptions_of"],
                    msg=(
                        f"Migration {running.external_id} is still moving these "
                        "subscriptions. Wait for it to finish."
                    ),
                    input=migration.subscriptions_of,
                )
            )
            continue

        if migration.to_catalog != catalog_after:
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.catalog_not_live,
                    loc=[*loc, "to_catalog"],
                    msg=(
                        "Migrations can only target the live catalog: "
                        f"version {catalog_after}."
                    ),
                    input=migration.to_catalog,
                )
            )
            continue

        target_change = product_changes.get(migration.target_external_id)
        target_id = live_product_ids.get(migration.target_external_id)
        if target_change is None and target_id is None:
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.unknown_reference,
                    loc=[
                        *loc,
                        "to_product" if migration.to_product else "subscriptions_of",
                    ],
                    msg="This product isn't in the target catalog.",
                    input=migration.target_external_id,
                )
            )
            continue
        if target_change is not None and (
            target_change.existing is None or target_change.update_dict
        ):
            target_id = None

        checks.append(
            MigrationCheck(
                migration,
                ConfigAction.created,
                await catalog_service.count_migratable_subscriptions(
                    session,
                    organization,
                    migration.subscriptions_of,
                    exclude_product_id=target_id,
                ),
            )
        )
    return checks, issues


async def apply_migrations(
    session: AsyncSession,
    organization: Organization,
    live: Catalog | None,
    migrations: Sequence[MigrationCheck],
) -> list[ConfigResult]:
    results: list[ConfigResult] = []
    for migration in migrations:
        if migration.action == ConfigAction.created:
            assert live is not None
            await catalog_service.start_migration(
                session,
                organization,
                live,
                external_id=migration.config.external_id,
                source_external_id=migration.config.subscriptions_of,
                target_external_id=migration.config.target_external_id,
            )
        results.append(
            ConfigResult(
                resource=ConfigResource.migration,
                external_id=migration.config.external_id,
                action=migration.action,
            )
        )
    return results


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


def migration_changes(migrations: Sequence[MigrationCheck]) -> list[ConfigChange]:
    return [
        ConfigChange(
            resource=ConfigResource.migration,
            external_id=migration.config.external_id,
            action=migration.action,
            diff=[
                ConfigFieldChange(
                    field="subscriptions", before=None, after=migration.subscriptions
                ),
                ConfigFieldChange(
                    field="target",
                    before=None,
                    after=(
                        f"{migration.config.target_external_id}"
                        f"@{migration.config.to_catalog}"
                    ),
                ),
            ],
        )
        for migration in migrations
    ]


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
