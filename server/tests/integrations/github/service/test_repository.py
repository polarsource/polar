import pytest

from polar.integrations.github.service.repository import github_repository
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import ExternalOrganization
from tests.fixtures.database import SaveFixture

from ..conftest import create_github_repository


@pytest.mark.asyncio
async def test_create_or_update_from_github(
    session: AsyncSession,
    external_organization: ExternalOrganization,
) -> None:
    # then
    session.expunge_all()

    created_repo = await github_repository.create_or_update_from_github(
        session,
        external_organization,
        data=create_github_repository(id=123, name="testrepo", private=False),
    )

    again_repo = await github_repository.create_or_update_from_github(
        session,
        external_organization,
        data=create_github_repository(id=123, name="testrepo", private=False),
    )

    # same repo is returned
    assert created_repo.id == again_repo.id


@pytest.mark.asyncio
async def test_create_or_update_from_github_deleted_repo(
    session: AsyncSession,
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
) -> None:
    # then
    session.expunge_all()

    first_repo = await github_repository.create_or_update_from_github(
        session,
        external_organization,
        data=create_github_repository(id=123, name="testrepo", private=False),
    )

    # repo is deleted
    first_repo.deleted_at = utc_now()
    await save_fixture(first_repo)

    # a new repo with the same name, but different id is created

    second_repo = await github_repository.create_or_update_from_github(
        session,
        external_organization,
        data=create_github_repository(id=5555, name="testrepo", private=False),
    )

    # new repo is returned
    assert second_repo.id != first_repo.id

    # first repo has been renamed
    get_first_repo = await github_repository.get_by_external_id(
        session, first_repo.external_id
    )
    assert get_first_repo
    assert get_first_repo.name != "testrepo"
    assert "renamed" in get_first_repo.name
