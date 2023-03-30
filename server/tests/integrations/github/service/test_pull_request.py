from datetime import datetime

import pytest
from sqlalchemy import text

from polar.integrations.github import client as github
from polar.integrations.github.service import (
    github_organization,
    github_pull_request,
    github_repository,
)
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms
from polar.postgres import AsyncSession
from polar.repository.schemas import RepositoryCreate
from tests.fixtures.vcr import read_cassette


def simple_pull_request() -> github.rest.PullRequestSimple:
    body = read_cassette("github/pull_request/simple.json")
    return github.rest.PullRequestSimple(**body)


def full_pull_request() -> github.rest.PullRequest:
    body = read_cassette("github/pull_request/full.json")
    return github.rest.PullRequest(**body)


async def create_org(session: AsyncSession) -> Organization:
    create_schema = OrganizationCreate(
        platform=Platforms.github,
        name="testorg",
        external_id=123,
        avatar_url="account.avatar_url",
        is_personal=False,
        installation_id=123,
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )

    org = await github_organization.upsert(session, create_schema)
    session.add(org)
    await session.commit()
    return org


async def create_repo(session: AsyncSession, org: Organization) -> Repository:
    create_schema = RepositoryCreate(
        platform=Platforms.github,
        name="testrepo",
        organization_id=org.id,
        external_id=12345,
        is_private=True,
    )
    repo = await github_repository.upsert(session, create_schema)
    session.add(repo)
    await session.commit()
    return repo


@pytest.mark.asyncio
async def test_create_pull_request(
    session: AsyncSession,
) -> None:

    # Remove from db if exists
    await session.execute(
        text("delete from pull_requests where external_id = 1258704582")
    )

    # Create org and repo
    org = await create_org(session)
    repo = await create_repo(session, org)

    simple = simple_pull_request()
    assert simple.id == 1258704582
    assert simple.number == 519

    # Store simple
    created = await github_pull_request.store_simple(
        session,
        data=simple,
        organization=org,
        repository=repo,
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
        organization=org,
        repository=repo,
    )

    assert stored_full is not None
    assert stored_full.id == created.id
    assert stored_full.additions == 12
    assert stored_full.deletions == 12

    # Store simple, make sure that no fileds where removed

    stored_simple_again = await github_pull_request.store_simple(
        session,
        data=simple,
        organization=org,
        repository=repo,
    )

    assert stored_simple_again is not None
    assert stored_simple_again.additions == 12
    assert stored_simple_again.deletions == 12
