from datetime import timedelta

import pytest

from polar.catalog.service import catalog as catalog_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Catalog, Organization
from polar.models.catalog import CatalogStatus
from scripts.backfill_catalog_names import backfill_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture


@pytest.mark.anyio
class TestBackfillCatalogNames:
    async def test_names_by_position(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        now = utc_now()
        first = Catalog(
            organization=organization,
            status=CatalogStatus.archived,
            created_at=now - timedelta(days=3),
        )
        named = Catalog(
            organization=organization,
            name="Spring pricing",
            status=CatalogStatus.archived,
            created_at=now - timedelta(days=2),
        )
        deleted = Catalog(
            organization=organization,
            status=CatalogStatus.archived,
            created_at=now - timedelta(days=1),
            deleted_at=now,
        )
        live = Catalog(organization=organization, status=CatalogStatus.live)
        other = Catalog(organization=organization_second, status=CatalogStatus.live)
        for catalog in (first, named, deleted, live, other):
            await save_fixture(catalog)

        updated = await run_batched_update(
            backfill_statement(), batch_size=1, sleep_seconds=0, session=session
        )

        assert updated == 4
        for catalog in (first, named, deleted, live, other):
            await session.refresh(catalog)
        assert [c.name for c in (first, named, deleted, live, other)] == [
            "v1",
            "Spring pricing",
            "v3",
            "v4",
            "v1",
        ]
        assert await catalog_service.get_default_name(session, organization) == "v5"
        assert (
            await run_batched_update(
                backfill_statement(), batch_size=1, sleep_seconds=0, session=session
            )
            == 0
        )
