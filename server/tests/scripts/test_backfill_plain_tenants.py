import uuid
from typing import cast
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization, UserOrganization
from scripts.backfill_plain_tenants import run_backfill


@pytest.mark.asyncio
class TestBackfillPlainTenants:
    async def test_dry_run_smoke(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch(
            "scripts.backfill_plain_tenants.settings.POLAR_ORGANIZATION_ID",
            str(uuid.uuid4()),
        )
        mocker.patch(
            "scripts.backfill_plain_tenants.plain_service.list_all_tenant_external_ids",
            AsyncMock(return_value=set()),
        )

        sessionmaker = create_async_sessionmaker(cast(AsyncEngine, session.bind))

        result = await run_backfill(
            session=session, sessionmaker=sessionmaker, dry_run=True
        )

        assert result.tenants_upserted == 0
        assert result.members_added == 0
        assert result.tenant_errors == 0
        assert result.member_errors == 0
