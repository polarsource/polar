import asyncio
from uuid import UUID

import pytest
from sqlalchemy import delete, func, select

from polar.config import settings
from polar.exceptions import NotPermitted
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.license_key.repository import LicenseKeyRepository
from polar.license_key.schemas import LicenseKeyActivate
from polar.license_key.service import license_key as license_key_service
from polar.models import Account, LicenseKey, LicenseKeyActivation, Organization, User
from polar.models.license_key import LicenseKeyStatus
from tests.fixtures.database import get_database_url, save_fixture_factory
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
