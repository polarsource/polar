import asyncio
from typing import cast
from unittest.mock import call
from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import delete, func, select

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.strategies.license_keys.properties import (
    BenefitGrantLicenseKeysProperties,
)
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeysCreateProperties,
)
from polar.config import settings
from polar.exceptions import BadRequest, NotPermitted
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.license_key.repository import LicenseKeyRepository
from polar.license_key.schemas import (
    LicenseKeyActivate,
    LicenseKeyUpdate,
    LicenseKeyValidate,
)
from polar.license_key.service import RotateNotPermitted
from polar.license_key.service import license_key as license_key_service
from polar.models import (
    Account,
    BenefitGrant,
    Customer,
    LicenseKey,
    LicenseKeyActivation,
    Organization,
    Product,
    User,
)
from polar.models.license_key import LicenseKeyStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture, get_database_url, save_fixture_factory
from tests.fixtures.license_key import TestLicenseKey
from tests.fixtures.random_objects import (
    create_account,
    create_benefit,
    create_customer,
    create_organization,
    create_user,
)


async def _attempt_activation(
    sessionmaker: AsyncSessionMaker, license_key_id: UUID, label: str
) -> bool:
    async with sessionmaker() as session:
        repository = LicenseKeyRepository.from_session(session)
        license_key = await repository.get_by_id(license_key_id)
        assert license_key is not None
        try:
            await license_key_service.activate(
                session,
                license_key=license_key,
                activate=LicenseKeyActivate(
                    key=license_key.key,
                    organization_id=license_key.organization_id,
                    label=label,
                    conditions={},
                    meta={},
                ),
            )
        except NotPermitted:
            await session.rollback()
            return False
        await session.commit()
        return True


@pytest.mark.asyncio
class TestConcurrentActivation:
    async def test_limit_enforced_under_concurrency(self, worker_id: str) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_lk_concurrency",
            pool_size=8,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)
            organization = await create_organization(save_fixture, account)
            customer = await create_customer(save_fixture, organization=organization)
            benefit = await create_benefit(save_fixture, organization=organization)
            license_key = LicenseKey(
                organization_id=organization.id,
                customer_id=customer.id,
                benefit_id=benefit.id,
                key="testing-concurrent-activation",
                status=LicenseKeyStatus.granted,
                limit_activations=1,
            )
            setup_session.add(license_key)
            await setup_session.commit()

        try:
            results = await asyncio.gather(
                *(
                    _attempt_activation(sessionmaker, license_key.id, f"activation-{i}")
                    for i in range(5)
                )
            )

            async with sessionmaker() as session:
                activation_count = (
                    await session.execute(
                        select(func.count(LicenseKeyActivation.id)).where(
                            LicenseKeyActivation.license_key_id == license_key.id
                        )
                    )
                ).scalar_one()

            assert results.count(True) == 1
            assert activation_count == 1
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(delete(User).where(User.id == user.id))
                await cleanup_session.commit()
            await engine.dispose()


async def _attempt_validation(
    sessionmaker: AsyncSessionMaker, license_key_id: UUID
) -> bool:
    async with sessionmaker() as session:
        repository = LicenseKeyRepository.from_session(session)
        license_key = await repository.get_by_id(license_key_id)
        assert license_key is not None
        try:
            await license_key_service.validate(
                session,
                license_key=license_key,
                validate=LicenseKeyValidate(
                    key=license_key.key,
                    organization_id=license_key.organization_id,
                    increment_usage=1,
                    conditions={},
                ),
            )
        except BadRequest:
            await session.rollback()
            return False
        await session.commit()
        return True


@pytest.mark.asyncio
class TestConcurrentValidation:
    async def test_usage_limit_enforced_under_concurrency(self, worker_id: str) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_lk_validate_concurrency",
            pool_size=8,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)
            organization = await create_organization(save_fixture, account)
            customer = await create_customer(save_fixture, organization=organization)
            benefit = await create_benefit(save_fixture, organization=organization)
            license_key = LicenseKey(
                organization_id=organization.id,
                customer_id=customer.id,
                benefit_id=benefit.id,
                key="testing-concurrent-validation",
                status=LicenseKeyStatus.granted,
                limit_usage=3,
            )
            setup_session.add(license_key)
            await setup_session.commit()

        try:
            results = await asyncio.gather(
                *(_attempt_validation(sessionmaker, license_key.id) for _ in range(5))
            )

            async with sessionmaker() as session:
                usage = (
                    await session.execute(
                        select(LicenseKey.usage).where(LicenseKey.id == license_key.id)
                    )
                ).scalar_one()

            assert results.count(True) == 3
            assert usage == 3
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(delete(User).where(User.id == user.id))
                await cleanup_session.commit()
            await engine.dispose()


async def _license_key_and_grant(
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    customer: Customer,
    organization: Organization,
    product: Product,
) -> tuple[LicenseKey, BenefitGrant]:
    benefit, granted = await TestLicenseKey.create_benefit_and_grant(
        session,
        redis,
        save_fixture,
        customer=customer,
        organization=organization,
        product=product,
        properties=BenefitLicenseKeysCreateProperties(prefix="testing"),
    )
    license_key_repository = LicenseKeyRepository.from_session(session)
    license_key = await license_key_repository.get_by_id(
        UUID(granted["license_key_id"])
    )
    assert license_key is not None

    grant_repository = BenefitGrantRepository.from_session(session)
    grant = await grant_repository.get_by_property_and_organization(
        organization.id,
        "license_key_id",
        str(license_key.id),
        benefit_id=benefit.id,
    )
    assert grant is not None
    return license_key, grant


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.parametrize(
        "status", [LicenseKeyStatus.granted, LicenseKeyStatus.disabled]
    )
    async def test_non_revoked_status_enqueues_sync(
        self,
        status: LicenseKeyStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.license_key.service.enqueue_job")
        webhook_send_mock = mocker.patch(
            "polar.license_key.service.webhook_service.send"
        )
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = LicenseKeyStatus.revoked
        grant.set_revoked()
        await save_fixture(grant)

        await license_key_service.update(
            session,
            license_key=license_key,
            updates=LicenseKeyUpdate(status=status),
        )

        assert license_key.status == status
        assert enqueue_job_mock.call_args_list == [
            call("license_key.sync_benefit_grant", license_key_id=license_key.id),
            call("customer.state_changed", grant.customer_id),
        ]
        webhook_send_mock.assert_called_once()
        assert (
            webhook_send_mock.call_args[0][2] == WebhookEventType.benefit_grant_updated
        )
        assert webhook_send_mock.call_args[0][3].id == grant.id

    async def test_revoked_status_enqueues_sync(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.license_key.service.enqueue_job")
        webhook_send_mock = mocker.patch(
            "polar.license_key.service.webhook_service.send"
        )
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )

        await license_key_service.update(
            session,
            license_key=license_key,
            updates=LicenseKeyUpdate(status=LicenseKeyStatus.revoked),
        )

        assert license_key.status == LicenseKeyStatus.revoked
        assert enqueue_job_mock.call_args_list == [
            call("license_key.sync_benefit_grant", license_key_id=license_key.id),
            call("customer.state_changed", grant.customer_id),
        ]
        webhook_send_mock.assert_called_once()
        assert (
            webhook_send_mock.call_args[0][2] == WebhookEventType.benefit_grant_updated
        )
        assert webhook_send_mock.call_args[0][3].id == grant.id

    async def test_status_already_matching_grant_skips_sync(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.license_key.service.enqueue_job")
        webhook_send_mock = mocker.patch(
            "polar.license_key.service.webhook_service.send"
        )
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )

        await license_key_service.update(
            session,
            license_key=license_key,
            updates=LicenseKeyUpdate(status=LicenseKeyStatus.disabled),
        )

        assert license_key.status == LicenseKeyStatus.disabled
        enqueue_job_mock.assert_called_once_with(
            "customer.state_changed", grant.customer_id
        )
        webhook_send_mock.assert_called_once()
        assert (
            webhook_send_mock.call_args[0][2] == WebhookEventType.benefit_grant_updated
        )
        assert webhook_send_mock.call_args[0][3].id == grant.id

    async def test_update_without_status_sends_webhook(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.license_key.service.enqueue_job")
        webhook_send_mock = mocker.patch(
            "polar.license_key.service.webhook_service.send"
        )
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )

        await license_key_service.update(
            session,
            license_key=license_key,
            updates=LicenseKeyUpdate(limit_activations=5),
        )

        assert license_key.limit_activations == 5
        enqueue_job_mock.assert_called_once_with(
            "customer.state_changed", grant.customer_id
        )
        webhook_send_mock.assert_called_once()
        assert (
            webhook_send_mock.call_args[0][2] == WebhookEventType.benefit_grant_updated
        )
        assert webhook_send_mock.call_args[0][3].id == grant.id


@pytest.mark.asyncio
class TestRotate:
    async def test_rotates_key_and_updates_grant_display_key(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.license_key.service.enqueue_job")
        webhook_send_mock = mocker.patch(
            "polar.license_key.service.webhook_service.send"
        )
        license_key, grant = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        old_key = license_key.key
        old_id = license_key.id
        old_properties = cast(BenefitGrantLicenseKeysProperties, grant.properties)
        old_display_key = old_properties["display_key"]

        rotated = await license_key_service.rotate(session, license_key=license_key)

        assert rotated.id == old_id
        assert rotated.key != old_key
        assert rotated.key.startswith("TESTING-")
        assert rotated.status == LicenseKeyStatus.granted
        assert rotated.display_key != old_display_key
        assert rotated.display_key == f"****-{rotated.key[-6:]}"

        repository = LicenseKeyRepository.from_session(session)
        assert (
            await repository.get_by_organization_and_key(organization.id, old_key)
            is None
        )
        assert (
            await repository.get_by_organization_and_key(organization.id, rotated.key)
            is not None
        )

        await session.refresh(grant)
        properties = cast(BenefitGrantLicenseKeysProperties, grant.properties)
        assert properties["display_key"] == rotated.display_key
        assert properties["license_key_id"] == str(rotated.id)

        webhook_send_mock.assert_called_once()
        assert (
            webhook_send_mock.call_args[0][2] == WebhookEventType.benefit_grant_updated
        )
        sent_grant = webhook_send_mock.call_args[0][3]
        assert sent_grant.id == grant.id
        assert sent_grant.previous_properties["display_key"] == old_display_key
        enqueue_job_mock.assert_called_once_with(
            "customer.state_changed", grant.customer_id
        )

    async def test_revoked_raises_bad_request(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        license_key, _ = await _license_key_and_grant(
            session, redis, save_fixture, customer, organization, product
        )
        license_key.status = LicenseKeyStatus.revoked
        await save_fixture(license_key)

        with pytest.raises(
            RotateNotPermitted,
            match=(
                "License key cannot be rotated in its current status. "
                "Current status: revoked. "
                "Allowed statuses: disabled, granted."
            ),
        ):
            await license_key_service.rotate(session, license_key=license_key)
