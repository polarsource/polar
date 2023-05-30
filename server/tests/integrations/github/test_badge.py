from unittest.mock import patch
import pytest
from pytest_mock import MockerFixture
from polar.config import settings

from polar.integrations.github.badge import GithubBadge
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.postgres import AsyncSession


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


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", False)
async def test_should_add_badge_app_config_disabled(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=False,
    )
    assert res == (False, "app_badge_not_enabled")


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_org_not_onboarded(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = True
    await repository.save(session)

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=False,
    )

    assert res == (False, "org_not_onboarded")


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_no_badge_with_auto(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = True
    await repository.save(session)
    organization.onboarded_at = utc_now()
    await organization.save(session)

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=False,
    )

    assert res == (True, "repository_pledge_badge_auto_embed")


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_no_badge_without_auto(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = False
    await repository.save(session)
    organization.onboarded_at = utc_now()
    await organization.save(session)

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=False,
    )

    assert res == (False, "no_auto_embed_or_label")


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_issue_previousy_embedded(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = False
    await repository.save(session)
    organization.onboarded_at = utc_now()
    await organization.save(session)
    issue.pledge_badge_ever_embedded = True
    await issue.save(session)

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=False,
    )

    assert res == (False, "badge_previously_embedded")


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_issue_previousy_embedded_label(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = False
    await repository.save(session)
    organization.onboarded_at = utc_now()
    await organization.save(session)
    issue.pledge_badge_ever_embedded = True
    await issue.save(session)

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=True,
    )

    assert res == (True, "triggered_from_label")
