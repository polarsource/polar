import pytest
from sqlalchemy import text

from polar.integrations.github import client as github
from polar.integrations.github.service import (
    github_pull_request,
)
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.postgres import AsyncSession
from tests.fixtures.vcr import read_cassette


def simple_pull_request() -> github.models.PullRequestSimple:
    body = read_cassette("github/pull_request/simple.json")
    return github.models.PullRequestSimple(**body)


def full_pull_request() -> github.models.PullRequest:
    body = read_cassette("github/pull_request/full.json")
    return github.models.PullRequest(**body)


@pytest.mark.asyncio
async def test_create_pull_request(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
) -> None:
    # Remove from db if exists
    await session.execute(
        text("delete from pull_requests where external_id = 1258704582")
    )

    # then
    session.expunge_all()

    simple = simple_pull_request()
    assert simple.id == 1258704582
    assert simple.number == 519

    # Store simple
    created = await github_pull_request.store_simple(
        session,
        data=simple,
        organization=organization,
        repository=repository,
    )

    assert created is not None
    assert created.external_id == 1258704582
    assert created.number == 519
    assert created.additions is None
    assert created.deletions is None

    # Store full, more fields should now be available
    full = full_pull_request()
    assert full.id == simple.id
    assert full.number == simple.number

    stored_full = await github_pull_request.store_full(
        session,
        full,
        organization=organization,
        repository=repository,
    )

    assert stored_full is not None
    assert stored_full.id == created.id
    assert stored_full.additions == 12
    assert stored_full.deletions == 12

    # Store simple, make sure that no fileds where removed

    stored_simple_again = await github_pull_request.store_simple(
        session,
        data=simple,
        organization=organization,
        repository=repository,
    )

    assert stored_simple_again is not None
    assert stored_simple_again.additions == 12
    assert stored_simple_again.deletions == 12
