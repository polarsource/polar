import random
import uuid
from datetime import datetime

import pytest_asyncio

from polar.enums import Platforms
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge, PledgeState
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.models.user import User
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def predictable_organization(save_fixture: SaveFixture) -> Organization:
    organization = Organization(
        platform=Platforms.github,
        name="testorg",
        external_id=random.randrange(5000),
        avatar_url="http://avatar_url",
        is_personal=False,
        installation_id=random.randrange(5000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )
    await save_fixture(organization)
    return organization


@pytest_asyncio.fixture
async def predictable_pledging_organization(save_fixture: SaveFixture) -> Organization:
    organization = Organization(
        platform=Platforms.github,
        name="pledging_org",
        external_id=random.randrange(5000),
        avatar_url="http://avatar_url",
        is_personal=False,
        installation_id=random.randrange(5000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )
    await save_fixture(organization)
    return organization


@pytest_asyncio.fixture
async def predictable_repository(
    save_fixture: SaveFixture, predictable_organization: Organization
) -> Repository:
    repository = Repository(
        platform=Platforms.github,
        name="testrepo",
        organization_id=predictable_organization.id,
        external_id=random.randrange(5000),
        is_private=True,
    )
    await save_fixture(repository)
    return repository


@pytest_asyncio.fixture
async def predictable_issue(
    save_fixture: SaveFixture,
    predictable_organization: Organization,
    predictable_repository: Repository,
) -> Issue:
    issue = Issue(
        id=uuid.uuid4(),
        organization_id=predictable_organization.id,
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


@pytest_asyncio.fixture
async def predictable_pledge(
    save_fixture: SaveFixture,
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
    predictable_pledging_organization: Organization,
) -> Pledge:
    pledge = Pledge(
        id=uuid.uuid4(),
        by_organization_id=predictable_pledging_organization.id,
        issue_id=predictable_issue.id,
        repository_id=predictable_repository.id,
        organization_id=predictable_organization.id,
        amount=12345,
        fee=123,
        state=PledgeState.created,
    )
    await save_fixture(pledge)
    return pledge


@pytest_asyncio.fixture
async def predictable_pull_request(
    save_fixture: SaveFixture,
    predictable_organization: Organization,
    predictable_repository: Repository,
) -> PullRequest:
    pr = PullRequest(
        id=uuid.uuid4(),
        repository_id=predictable_repository.id,
        organization_id=predictable_organization.id,
        number=5555,
        external_id=random.randrange(5000),
        title="PR Title",
        author={"login": "pr_creator_login"},
        platform=Platforms.github,
        state="open",
        issue_created_at=datetime.now(),
        issue_modified_at=datetime.now(),
        commits=1,
        additions=2,
        deletions=3,
        changed_files=4,
        is_draft=False,
        is_rebaseable=True,
        is_mergeable=True,
        is_merged=False,
        review_comments=5,
        maintainer_can_modify=True,
        merged_at=None,
        merge_commit_sha=None,
        body="x",
    )
    await save_fixture(pr)
    return pr
