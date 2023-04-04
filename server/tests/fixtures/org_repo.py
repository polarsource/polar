from datetime import datetime
from uuid import UUID
from typing import AsyncGenerator
import uuid

import pytest_asyncio
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from polar.enums import Platforms

from polar.kit.utils import generate_uuid
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models import Model, StatusMixin
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.organization.schemas import OrganizationCreate
from polar.postgres import AsyncEngineLocal, AsyncSession, AsyncSessionLocal

from polar.integrations.github.service import (
    github_organization,
    github_pull_request,
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
        title="issue",
        number=123,
        platform=Platforms.github,
        external_id=99999,
        state="open",
        issue_created_at=datetime.now(),
        issue_updated_at=datetime.now(),
    )

    await session.commit()
    return issue
