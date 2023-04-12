from datetime import datetime
import uuid

import pytest_asyncio
from polar.enums import Platforms

from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization.schemas import OrganizationCreate
from polar.postgres import AsyncSession

from polar.integrations.github.service import (
    github_organization,
    github_repository,
)
from polar.repository.schemas import RepositoryCreate


@pytest_asyncio.fixture(scope="module")
async def organization(session: AsyncSession) -> Organization:
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


@pytest_asyncio.fixture(scope="module")
async def pledging_organization(session: AsyncSession) -> Organization:
    create_schema = OrganizationCreate(
        platform=Platforms.github,
        name="pledging_org",
        external_id=444,
        avatar_url="account.avatar_url",
        is_personal=False,
        installation_id=444,
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )

    org = await github_organization.upsert(session, create_schema)
    session.add(org)
    await session.commit()
    return org


@pytest_asyncio.fixture(scope="module")
async def repository(session: AsyncSession, organization: Organization) -> Repository:
    create_schema = RepositoryCreate(
        platform=Platforms.github,
        name="testrepo",
        organization_id=organization.id,
        external_id=12345,
        is_private=True,
    )
    repo = await github_repository.upsert(session, create_schema)
    session.add(repo)
    await session.commit()
    return repo


@pytest_asyncio.fixture(scope="module")
async def issue(
    session: AsyncSession, organization: Organization, repository: Repository
) -> Issue:
    issue = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue title",
        number=123,
        platform=Platforms.github,
        external_id=99999,
        state="open",
        issue_created_at=datetime.now(),
        issue_updated_at=datetime.now(),
    )

    await session.commit()
    return issue


@pytest_asyncio.fixture(scope="module")
async def user(
    session: AsyncSession,
) -> User:
    user = await User.create(
        session=session,
        id=uuid.uuid4(),
        username="foobar",
        email="test@example.com",
    )

    await session.commit()
    return user


@pytest_asyncio.fixture(scope="module")
async def pledge_as_org(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    pledging_organization: Organization,
) -> Pledge:
    pledge = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        by_organization_id=pledging_organization.id,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12345,
    )

    await session.commit()
    return pledge


@pytest_asyncio.fixture(scope="module")
async def pull_request(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
) -> PullRequest:
    pr = await PullRequest.create(
        session=session,
        id=uuid.uuid4(),
        repository_id=repository.id,
        organization_id=organization.id,
        number=5555,
        external_id=5951111,
        title="PR Title",
        author={"login": "pr_creator_login"},
        platform=Platforms.github,
        state="open",
        issue_created_at=datetime.now(),
        issue_updated_at=datetime.now(),
    )

    await session.commit()
    return pr


@pytest_asyncio.fixture(scope="module")
async def user_organization(
    session: AsyncSession,
    organization: Organization,
    user: User,
) -> UserOrganization:
    a = await UserOrganization.create(
        session=session,
        id=uuid.uuid4(),
        user_id=user.id,
        organization_id=organization.id,
    )

    await session.commit()
    return a
