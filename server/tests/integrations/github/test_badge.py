from datetime import datetime

import pytest
from sqlalchemy import text

from polar.integrations.github import client as github
from polar.integrations.github.badge import GithubBadge
from polar.integrations.github.service import (
    github_organization,
    github_pull_request,
    github_repository,
)
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms
from polar.postgres import AsyncSession
from polar.repository.schemas import RepositoryCreate
from tests.fixtures.vcr import read_cassette


BADGED_BODY = """Hello my issue

<!-- POLAR PLEDGE BADGE START -->
<a href="http://127.0.0.1:3000/testorg/testrepo/issues/123">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg?darkmode=1">
  <img alt="Fund with Polar" src="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg">
</picture>
</a>
<!-- POLAR PLEDGE BADGE END -->
"""


@pytest.mark.asyncio
async def test_add_badge(
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
) -> None:
    res = GithubBadge(
        organization=predictable_organization,
        repository=predictable_repository,
        issue=predictable_issue,
    ).generate_body_with_badge("""Hello my issue""")

    assert res == BADGED_BODY


@pytest.mark.asyncio
async def test_remove_badge(
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
) -> None:
    res = GithubBadge(
        organization=predictable_organization,
        repository=predictable_repository,
        issue=predictable_issue,
    ).generate_body_without_badge(BADGED_BODY)

    assert res == "Hello my issue"


@pytest.mark.asyncio
async def test_remove_badge_pre_2023_05_08(
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
) -> None:
    res = GithubBadge(
        organization=predictable_organization,
        repository=predictable_repository,
        issue=predictable_issue,
    ).generate_body_without_badge(
        """This is what the badge used to look like pre 2023-05-08
        
<!-- POLAR PLEDGE BADGE -->
[![Fund with Polar](http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg)](http://127.0.0.1:3000/testorg/testrepo/issues/123)"""
    )

    assert res == "This is what the badge used to look like pre 2023-05-08"
