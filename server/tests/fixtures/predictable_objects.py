import random
import uuid
from datetime import datetime

import pytest_asyncio

from polar.enums import Platforms
from polar.models.external_organization import ExternalOrganization
from polar.models.issue import Issue
from polar.models.repository import Repository
from polar.models.user import User
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_external_organization


@pytest_asyncio.fixture
async def predictable_external_organization(
    save_fixture: SaveFixture,
) -> ExternalOrganization:
    return await create_external_organization(save_fixture)


@pytest_asyncio.fixture
async def predictable_repository(
    save_fixture: SaveFixture, predictable_external_organization: ExternalOrganization
) -> Repository:
    repository = Repository(
        platform=Platforms.github,
        name="testrepo",
        organization_id=predictable_external_organization.id,
        external_id=random.randrange(5000),
        is_private=True,
    )
    await save_fixture(repository)
    return repository


@pytest_asyncio.fixture
async def predictable_issue(
    save_fixture: SaveFixture,
    predictable_external_organization: ExternalOrganization,
    predictable_repository: Repository,
) -> Issue:
    issue = Issue(
        id=uuid.uuid4(),
        organization_id=predictable_external_organization.id,
        repository_id=predictable_repository.id,
        title="issue title",
        number=123,
        platform=Platforms.github,
        external_id=random.randrange(5000),
        state="open",
        issue_created_at=datetime.now(),
        issue_modified_at=datetime.now(),
        external_lookup_key=str(uuid.uuid4()),  # not realistic
        issue_has_in_progress_relationship=False,
        issue_has_pull_request_relationship=False,
    )
    await save_fixture(issue)
    return issue


@pytest_asyncio.fixture
async def predictable_user(save_fixture: SaveFixture) -> User:
    user = User(
        id=uuid.uuid4(),
        username="foobar",
        email="test@example.com",
    )
    await save_fixture(user)
    return user
