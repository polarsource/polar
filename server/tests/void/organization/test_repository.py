import pytest

from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.organization.repository import OrganizationRepository


@pytest.mark.asyncio
class TestEnabledOrganizations:
    async def test_flag_changes_are_read_from_database(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        repository = OrganizationRepository.from_session(session)
        assert await repository.enabled_ids() == set()
        assert not await repository.is_enabled(organization.id)

        organization.feature_settings = {
            **organization.feature_settings,
            "void_enabled": True,
        }
        await session.flush()
        assert await repository.enabled_ids() == {organization.id}
        assert await repository.is_enabled(organization.id)
        assert not await repository.is_enabled(organization_second.id)

        organization.feature_settings = {
            **organization.feature_settings,
            "void_enabled": False,
        }
        await session.flush()
        assert await repository.enabled_ids() == set()
        assert not await repository.is_enabled(organization.id)

    async def test_enabled_flag_does_not_bypass_organization_access(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.feature_settings = {
            **organization.feature_settings,
            "void_enabled": True,
        }
        organization.capabilities = {**organization.capabilities, "api_access": False}
        await session.flush()
        repository = OrganizationRepository.from_session(session)
        assert await repository.enabled_ids() == set()
        assert not await repository.is_enabled(organization.id)
