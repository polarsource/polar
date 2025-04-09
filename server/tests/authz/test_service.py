import pytest

from polar.auth.models import Anonymous
from polar.authz.service import AccessType, Authz
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
async def test_can_write_organization(
    session: AsyncSession,
    organization: Organization,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
    save_fixture: SaveFixture,
) -> None:
    # then
    session.expunge_all()

    assert (
        await Authz(session).can(
            Anonymous(),
            AccessType.write,
            organization,
        )
        is False
    )

    assert (
        await Authz(session).can(
            user,
            AccessType.write,
            organization,
        )
        is True
    )

    assert (
        await Authz(session).can(
            user_second,
            AccessType.write,
            organization,
        )
        is False
    )


@pytest.mark.asyncio
async def test_can_read_organization(
    session: AsyncSession,
    organization: Organization,
    user: User,
) -> None:
    # then
    session.expunge_all()

    authz = Authz(session)

    assert (
        await authz.can(
            Anonymous(),
            AccessType.read,
            organization,
        )
        is True
    )

    assert (
        await authz.can(
            user,
            AccessType.read,
            organization,
        )
        is True
    )
