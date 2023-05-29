from datetime import datetime
import random
import string
import uuid

import pytest_asyncio
from polar.enums import Platforms

import secrets

from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization.schemas import OrganizationCreate
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession

from polar.integrations.github.service import (
    github_organization,
    github_repository,
)
from polar.repository.schemas import RepositoryCreate


def rstr(prefix: str) -> str:
    return prefix + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@pytest_asyncio.fixture(scope="function")
async def organization(session: AsyncSession) -> Organization:
    return await create_organization(session)


async def create_organization(session: AsyncSession) -> Organization:
    create_schema = OrganizationCreate(
        platform=Platforms.github,
        name=rstr("testorg"),
        external_id=secrets.randbelow(100000),
        avatar_url="http://avatar_url",
        is_personal=False,
        installation_id=secrets.randbelow(100000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )

    org = await github_organization.upsert(session, create_schema)
    session.add(org)
    await session.commit()
    return org


@pytest_asyncio.fixture(scope="function")
async def pledging_organization(session: AsyncSession) -> Organization:
    create_schema = OrganizationCreate(
        platform=Platforms.github,
        name=rstr("pledging_org"),
        external_id=secrets.randbelow(100000),
        avatar_url="http://avatar_url",
        is_personal=False,
        installation_id=secrets.randbelow(100000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )

    org = await github_organization.upsert(session, create_schema)
    session.add(org)
    await session.commit()
    return org


@pytest_asyncio.fixture(scope="function")
async def repository(session: AsyncSession, organization: Organization) -> Repository:
    return await create_repository(session, organization)


async def create_repository(
    session: AsyncSession, organization: Organization
) -> Repository:
    create_schema = RepositoryCreate(
        platform=Platforms.github,
        name=rstr("testrepo"),
        organization_id=organization.id,
        external_id=secrets.randbelow(100000),
        is_private=True,
    )
    repo = await github_repository.upsert(session, create_schema)
    session.add(repo)
    await session.commit()
    return repo


@pytest_asyncio.fixture(scope="function")
async def issue(
    session: AsyncSession, organization: Organization, repository: Repository
) -> Issue:
    return await create_issue(session, organization, repository)


async def create_issue(
    session: AsyncSession, organization: Organization, repository: Repository
) -> Issue:
    issue = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue title",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime.now(),
        issue_modified_at=datetime.now(),
    )

    await session.commit()
    return issue


@pytest_asyncio.fixture(scope="function")
async def user(
    session: AsyncSession,
) -> User:
    user = await User.create(
        session=session,
        id=uuid.uuid4(),
        username=rstr("testuser"),
        email=rstr("test") + "@example.com",
        invite_only_approved=True,
    )

    await session.commit()
    return user


@pytest_asyncio.fixture(scope="function")
async def user_second(
    session: AsyncSession,
) -> User:
    user = await User.create(
        session=session,
        id=uuid.uuid4(),
        username=rstr("testuser"),
        email=rstr("test") + "@example.com",
        invite_only_approved=True,
    )

    await session.commit()
    return user


@pytest_asyncio.fixture(scope="function")
async def pledge(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    pledging_organization: Organization,
) -> Pledge:
    amount = secrets.randbelow(100000) + 1
    fee = round(amount * 0.05)
    pledge = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        by_organization_id=pledging_organization.id,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=amount,
        fee=fee,
        state=PledgeState.created,
    )

    await session.commit()
    return pledge


@pytest_asyncio.fixture(scope="function")
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
        number=secrets.randbelow(5000),
        external_id=secrets.randbelow(5000),
        title="PR Title",
        author={"login": "pr_creator_login"},
        platform=Platforms.github,
        state="open",
        issue_created_at=datetime.now(),
        issue_modified_at=datetime.now(),
    )

    await session.commit()
    return pr


@pytest_asyncio.fixture(scope="function")
async def user_organization(
    session: AsyncSession,
    organization: Organization,
    user: User,
) -> UserOrganization:
    a = await UserOrganization.create(
        session=session,
        user_id=user.id,
        organization_id=organization.id,
    )

    await session.commit()
    return a


@pytest_asyncio.fixture(scope="function")
async def user_organization_second(
    session: AsyncSession,
    organization: Organization,
    user_second: User,
) -> UserOrganization:
    a = await UserOrganization.create(
        session=session,
        user_id=user_second.id,
        organization_id=organization.id,
    )

    await session.commit()
    return a
