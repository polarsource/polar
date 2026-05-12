import uuid

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
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

        result = await run_backfill(session=session, dry_run=True)

        assert result.tenants_upserted == 0
        assert result.members_added == 0
        assert result.tenant_errors == 0
        assert result.member_errors == 0
