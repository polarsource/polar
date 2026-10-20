from typing import Any

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.catalog.repository import (
    CatalogMigrationRepository,
    CatalogProductRepository,
    CatalogRepository,
)
from polar.declarative_config.schemas import (
    Config,
    ConfigAction,
    ConfigCatalogChange,
    ConfigIssueType,
    ConfigResource,
)
from polar.declarative_config.service import ConfigInvalid
from polar.declarative_config.service import (
    declarative_config as declarative_config_service,
)
from polar.enums import SubscriptionRecurringInterval
from polar.kit.pagination import PaginationParams
from polar.models import Customer, Organization, Product, ProductPriceFixed
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.redis import Redis
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription, create_product

PRO = {
    "external_id": "pro",
    "name": "Pro",
    "recurring_interval": "month",
    "prices": [{"amount_type": "fixed", "price_amount": 2000}],
}
PRO_25 = {**PRO, "prices": [{"amount_type": "fixed", "price_amount": 2500}]}
MIGRATION = {"external_id": "pro-to-25", "subscriptions_of": "pro", "to_catalog": 2}


@pytest.fixture
async def catalog_versioning_enabled(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "config_as_code_enabled": True,
        "catalog_versioning_enabled": True,
    }
    await save_fixture(organization)


async def _apply(
    session: AsyncSession,
    redis: Redis,
    auth_subject: AuthSubject[Organization],
    config: dict[str, Any],
) -> Any:
    return await declarative_config_service.apply(
        session, redis, auth_subject, Config.model_validate(config)
    )


async def _current_product(
    session: AsyncSession, organization: Organization
) -> Product:
    [product] = await ProductRepository.from_session(session).get_all_by_external_ids(
        organization.id, ["pro"]
    )
    return product


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
@pytest.mark.usefixtures("catalog_versioning_enabled")
class TestCatalogVersioning:
    async def test_create_publishes_first_catalog(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        result = await _apply(session, redis, auth_subject, {"products": [PRO]})

        assert result.catalog == ConfigCatalogChange(before=None, after=1)
        product = await _current_product(session, organization)
        assert product.version == 1
        catalog = await CatalogRepository.from_session(session).get_live(
            organization.id
        )
        assert catalog is not None
        assert catalog.version == 1
        assert (
            await CatalogProductRepository.from_session(session).get_product(
                catalog.id, "pro"
            )
            == product
        )

    async def test_unchanged_does_not_publish(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        await _apply(session, redis, auth_subject, {"products": [PRO]})

        result = await _apply(session, redis, auth_subject, {"products": [PRO]})

        assert result.catalog is None
        assert result.changes[0].action == ConfigAction.unchanged

    async def test_update_creates_new_row(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        await _apply(session, redis, auth_subject, {"products": [PRO]})
        old_product = await _current_product(session, organization)
        subscription = await create_active_subscription(
            save_fixture, product=old_product, customer=customer
        )

        result = await _apply(session, redis, auth_subject, {"products": [PRO_25]})

        assert result.catalog == ConfigCatalogChange(before=1, after=2)
        new_product = await _current_product(session, organization)
        assert new_product.id != old_product.id
        assert new_product.version == 2
        [new_price] = new_product.prices
        assert isinstance(new_price, ProductPriceFixed)
        assert new_price.price_amount == 2500
        await session.refresh(old_product)
        assert old_product.is_current is False
        assert old_product.is_archived is False
        [old_price] = old_product.prices
        assert isinstance(old_price, ProductPriceFixed)
        assert old_price.price_amount == 2000
        await session.refresh(subscription)
        assert subscription.product_id == old_product.id

        catalog_repository = CatalogRepository.from_session(session)
        first = await catalog_repository.get_by_version(organization.id, 1)
        second = await catalog_repository.get_by_version(organization.id, 2)
        assert first is not None
        assert first.status == CatalogStatus.archived
        assert second is not None
        assert second.status == CatalogStatus.live
        catalog_product_repository = CatalogProductRepository.from_session(session)
        assert (
            await catalog_product_repository.get_product(first.id, "pro") == old_product
        )
        assert (
            await catalog_product_repository.get_product(second.id, "pro")
            == new_product
        )

    async def test_product_list_shows_current_rows(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await _apply(session, redis, auth_subject, {"products": [PRO]})
        await _apply(session, redis, auth_subject, {"products": [PRO_25]})

        products, count = await product_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert products[0] == await _current_product(session, organization)

    async def test_baseline_from_existing_products(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        existing = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
            name="Pro",
        )

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"products": [PRO_25]})
        )
        result = await _apply(session, redis, auth_subject, {"products": [PRO_25]})

        assert plan.catalog == ConfigCatalogChange(before=None, after=2)
        assert result.catalog == ConfigCatalogChange(before=1, after=2)
        await session.refresh(existing)
        assert existing.version == 1
        assert existing.is_current is False

    async def test_plan_shows_new_version(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        await _apply(session, redis, auth_subject, {"products": [PRO]})

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"products": [PRO_25]})
        )

        assert plan.catalog == ConfigCatalogChange(before=1, after=2)
        [change] = plan.changes
        assert change.action == ConfigAction.updated
        assert [(field.field, field.before, field.after) for field in change.diff][
            -1
        ] == ("version", 1, 2)

    async def test_migration(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        mocker.patch("polar.subscription.service.enqueue_job")
        await _apply(session, redis, auth_subject, {"products": [PRO]})
        old_product = await _current_product(session, organization)
        subscription = await create_active_subscription(
            save_fixture, product=old_product, customer=customer
        )
        config = {"products": [PRO_25], "migrations": [MIGRATION]}

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate(config)
        )
        result = await _apply(session, redis, auth_subject, config)

        migration_change = plan.changes[-1]
        assert migration_change.resource == ConfigResource.migration
        assert migration_change.action == ConfigAction.created
        assert [(field.field, field.after) for field in migration_change.diff] == [
            ("subscriptions", 1),
            ("target", "pro@2"),
        ]
        assert result.changes[-1].action == ConfigAction.created

        new_product = await _current_product(session, organization)
        updated = await SubscriptionRepository.from_session(session).get_by_id(
            subscription.id,
            options=SubscriptionRepository.from_session(session).get_eager_options(),
        )
        assert updated is not None
        assert updated.product_id == old_product.id
        assert updated.pending_update is not None
        assert updated.pending_update.product_id == new_product.id

        migration = await CatalogMigrationRepository.from_session(
            session
        ).get_by_external_id(organization.id, "pro-to-25")
        assert migration is not None
        assert migration.subscriptions_count == 1

        rerun = await _apply(session, redis, auth_subject, config)
        assert rerun.catalog is None
        assert rerun.changes[-1].action == ConfigAction.unchanged

    async def test_changed_migration(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        mocker.patch("polar.subscription.service.enqueue_job")
        await _apply(session, redis, auth_subject, {"products": [PRO]})
        await _apply(
            session,
            redis,
            auth_subject,
            {"products": [PRO_25], "migrations": [MIGRATION]},
        )

        with pytest.raises(ConfigInvalid) as error:
            await _apply(
                session,
                redis,
                auth_subject,
                {
                    "products": [PRO_25],
                    "migrations": [{**MIGRATION, "to_catalog": 3}],
                },
            )
        assert error.value.errors[0].type == ConfigIssueType.migration_changed

    async def test_migration_to_old_catalog(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        await _apply(session, redis, auth_subject, {"products": [PRO]})

        with pytest.raises(ConfigInvalid) as error:
            await _apply(
                session,
                redis,
                auth_subject,
                {
                    "products": [PRO_25],
                    "migrations": [{**MIGRATION, "to_catalog": 1}],
                },
            )
        assert error.value.errors[0].type == ConfigIssueType.unknown_reference
        assert error.value.errors[0].loc == ["body", "migrations", 0, "to_catalog"]


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
@pytest.mark.usefixtures("config_as_code_enabled")
async def test_migrations_need_catalog_versioning(
    session: AsyncSession,
    redis: Redis,
    auth_subject: AuthSubject[Organization],
    organization: Organization,
) -> None:
    with pytest.raises(ConfigInvalid) as error:
        await _apply(
            session,
            redis,
            auth_subject,
            {"products": [PRO], "migrations": [MIGRATION]},
        )
    assert error.value.errors[0].type == ConfigIssueType.not_supported

    await _apply(session, redis, auth_subject, {"products": [PRO]})
    product = await _current_product(session, organization)
    await _apply(session, redis, auth_subject, {"products": [PRO_25]})
    assert await _current_product(session, organization) == product
    assert (
        await CatalogRepository.from_session(session).get_live(organization.id) is None
    )
