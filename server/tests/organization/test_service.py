import pytest

from polar.enums import Platforms
from polar.kit.utils import utc_now
from polar.organization.schemas import (
    OrganizationCreateFromGitHubInstallation,
    OrganizationCreateFromGitHubUser,
)
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_create_or_update(session: AsyncSession) -> None:
    # then
    session.expunge_all()

    org = await organization_service.create_or_update(
        session,
        OrganizationCreateFromGitHubUser(
            platform=Platforms.github,
            name="foobar",
            avatar_url="http://example.com",
            external_id=123,
            is_personal=False,
        ),
    )

    assert org

    # with installation
    org2 = await organization_service.create_or_update(
        session,
        OrganizationCreateFromGitHubInstallation(
            platform=Platforms.github,
            name="foobar",
            avatar_url="http://example.com",
            external_id=123,
            is_personal=False,
            installation_id=555,
            installation_created_at=utc_now(),
            installation_updated_at=utc_now(),
            installation_permissions={},
        ),
    )

    assert org2
    assert org.id == org2.id

    # as user again, no installation fields gets removed
    org3 = await organization_service.create_or_update(
        session,
        OrganizationCreateFromGitHubUser(
            platform=Platforms.github,
            name="foobar2",
            avatar_url="http://example.com",
            external_id=123,
            is_personal=False,
        ),
    )

    assert org3
    assert org.id == org3.id
    assert org3.name == "foobar2"
    assert org3.installation_id

    # get org
    got = await organization_service.get_by_platform(session, Platforms.github, 123)
    assert got
    assert got.id == org.id
    assert got.installation_id
    assert got.installation_created_at
    assert got.installation_updated_at
