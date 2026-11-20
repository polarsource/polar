import asyncio
import uuid

from sqlalchemy import text
from sqlalchemy_utils import create_database, database_exists, drop_database

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.models import OrganizationAccessToken
from polar.reducer.service import reducer as reducer_service
from polar.worker import JobQueueManager
from tests.fixtures.database import (
    apply_migrations,
    get_database_url,
    save_fixture_factory,
)
from tests.fixtures.random_objects import (
    create_account,
    create_meter,
    create_organization,
    create_user,
)

DATABASE = "benchmarks_events"
TOKEN = "polar_oat_benchmark"


async def seed() -> None:
    engine = create_async_engine(
        dsn=get_database_url(DATABASE),
        application_name="benchmarks",
    )
    JobQueueManager.set()
    async with create_async_sessionmaker(engine)() as session:
        save_fixture = save_fixture_factory(session)
        user = await create_user(save_fixture)
        account = await create_account(save_fixture, user)
        organization = await create_organization(save_fixture, account)
        organization.feature_settings = {
            **organization.feature_settings,
            "staged_events_ingest_enabled": True,
        }
        await save_fixture(organization)
        meter = await create_meter(
            save_fixture, organization=organization, id=uuid.uuid4()
        )
        await reducer_service.sync_meter(session, meter)
        await save_fixture(
            OrganizationAccessToken(
                comment="benchmark",
                token=get_token_hash(TOKEN),
                organization=organization,
                scope=Scope.events_write.value,
            )
        )
        # The Python benchmarks never commit: leave the disk flush out here too.
        await session.execute(
            text(
                f'ALTER DATABASE "{settings.POSTGRES_DATABASE}_{DATABASE}" '
                "SET synchronous_commit = off"
            )
        )
        await session.commit()
    await engine.dispose()


sync_url = get_database_url(DATABASE, "psycopg")
if database_exists(sync_url):
    drop_database(sync_url)
create_database(sync_url)
apply_migrations(get_database_url(DATABASE))
asyncio.run(seed())
