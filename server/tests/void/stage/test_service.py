import asyncio

import pytest
from sqlalchemy import delete

from polar.config import settings
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.models import Account, Organization, User, VoidStage
from polar.void.stage.exceptions import StageConflict
from polar.void.stage.schemas import StageConfiguration, StageSave
from polar.void.stage.service import stage as stage_service
from tests.fixtures.database import get_database_url, save_fixture_factory
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_user,
)


@pytest.mark.asyncio
class TestStageConcurrency:
    @pytest.mark.parametrize("existing", [False, True])
    async def test_only_one_writer_can_save_a_revision(
        self, worker_id: str, existing: bool
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name="test_stage_concurrency",
            pool_size=2,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        maker = create_async_sessionmaker(engine)
        async with maker() as setup:
            save_fixture = save_fixture_factory(setup)
            user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)
            organization = await create_organization(save_fixture, account)
            body = StageSave(expected_revision=None, configuration=StageConfiguration())
            if existing:
                await stage_service.save(setup, organization.id, body)
            await setup.commit()

        try:
            async with maker() as first, maker() as second:
                if existing:
                    cached = await stage_service.get(second, organization.id)
                    assert cached.revision == 1
                body.expected_revision = 1 if existing else None
                saved = await stage_service.save(first, organization.id, body)
                competing_save = asyncio.create_task(
                    stage_service.save(second, organization.id, body)
                )
                await first.commit()
                with pytest.raises(StageConflict):
                    await asyncio.wait_for(competing_save, timeout=5)
                await second.rollback()
                current = await stage_service.get(second, organization.id)
                assert current.revision == saved.revision == (2 if existing else 1)
        finally:
            async with maker() as cleanup:
                await cleanup.execute(
                    delete(VoidStage).where(
                        VoidStage.organization_id == organization.id
                    )
                )
                await cleanup.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup.execute(delete(Account).where(Account.id == account.id))
                await cleanup.execute(delete(User).where(User.id == user.id))
                await cleanup.commit()
            await engine.dispose()
