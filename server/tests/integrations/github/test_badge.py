from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from polar.integrations.github.badge import GithubBadge
from polar.integrations.github.service.issue import github_issue
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_issue

BADGED_BODY = """Hello my issue

<!-- POLAR PLEDGE BADGE START -->
## Upvote & Fund

- We're using [Polar.sh](http://127.0.0.1:3000/testorg) so you can upvote and help fund this issue.
- We receive the funding once the issue is completed & confirmed by you.
- Thank you in advance for helping prioritize & fund our backlog.

<a href="http://127.0.0.1:3000/testorg/testrepo/issues/123">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg?darkmode=1">
  <img alt="Fund with Polar" src="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg">
</picture>
</a>
<!-- POLAR PLEDGE BADGE END -->
"""


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
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
async def test_add_badge_custom_content(
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    predictable_issue.badge_custom_content = "Hello, please sponsor me."
    await save_fixture(predictable_issue)

    predictable_organization.default_badge_custom_content = None
    await save_fixture(predictable_organization)

    # then
    session.expunge_all()

    res = GithubBadge(
        organization=predictable_organization,
        repository=predictable_repository,
        issue=predictable_issue,
    ).generate_body_with_badge("""Hello my issue""")

    assert (
        res
        == """Hello my issue

<!-- POLAR PLEDGE BADGE START -->
Hello, please sponsor me.

<a href="http://127.0.0.1:3000/testorg/testrepo/issues/123">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg?darkmode=1">
  <img alt="Fund with Polar" src="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg">
</picture>
</a>
<!-- POLAR PLEDGE BADGE END -->
"""
    )


@pytest.mark.asyncio
async def test_add_badge_custom_organization_content(
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    predictable_issue.badge_custom_content = None
    await save_fixture(predictable_issue)

    predictable_organization.default_badge_custom_content = (
        "Default message from organization."
    )
    await save_fixture(predictable_organization)

    # then
    session.expunge_all()

    res = GithubBadge(
        organization=predictable_organization,
        repository=predictable_repository,
        issue=predictable_issue,
    ).generate_body_with_badge("""Hello my issue""")

    assert (
        res
        == """Hello my issue

<!-- POLAR PLEDGE BADGE START -->
Default message from organization.

<a href="http://127.0.0.1:3000/testorg/testrepo/issues/123">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg?darkmode=1">
  <img alt="Fund with Polar" src="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg">
</picture>
</a>
<!-- POLAR PLEDGE BADGE END -->
"""
    )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
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
@pytest.mark.skip_db_asserts
async def test_remove_badge_custom_content(
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
) -> None:
    res = GithubBadge(
        organization=predictable_organization,
        repository=predictable_repository,
        issue=predictable_issue,
    ).generate_body_without_badge(
        """Hello my issue

<!-- POLAR PLEDGE BADGE START -->
Hello, please sponsor me.
Anything can go here!

<a href="http://127.0.0.1:3000/testorg/testrepo/issues/123">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg?darkmode=1">
  <img alt="Fund with Polar" src="http://127.0.0.1:3000/api/github/testorg/testrepo/issues/123/pledge.svg">
</picture>
</a>
<!-- POLAR PLEDGE BADGE END -->
"""
    )

    assert res == "Hello my issue"


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
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
@pytest.mark.skip_db_asserts
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
@pytest.mark.skip_db_asserts
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_org_not_installed(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = True
    await save_fixture(repository)

    organization.installation_id = None
    await save_fixture(organization)

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=False,
    )

    assert res == (False, "org_not_installed")


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_no_badge_with_auto(
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = True
    await save_fixture(repository)
    organization.onboarded_at = utc_now()
    await save_fixture(organization)

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
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = False
    await save_fixture(repository)
    organization.onboarded_at = utc_now()
    await save_fixture(organization)

    # then
    session.expunge_all()

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=False,
    )

    assert res == (False, "fallthrough")


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_should_add_badge_issue_previousy_embedded(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = False
    await save_fixture(repository)
    organization.onboarded_at = utc_now()
    await save_fixture(organization)
    issue.pledge_badge_ever_embedded = True
    await save_fixture(issue)

    # then
    session.expunge_all()

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
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    repository.pledge_badge_auto_embed = False
    await save_fixture(repository)
    organization.onboarded_at = utc_now()
    await save_fixture(organization)
    issue.pledge_badge_ever_embedded = True
    await save_fixture(issue)

    # then
    session.expunge_all()

    res = GithubBadge.should_add_badge(
        organization=organization,
        repository=repository,
        issue=issue,
        triggered_from_label=True,
    )

    assert res == (True, "triggered_from_label")


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_list_issues_to_add_badge_to_auto(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
) -> None:
    i1 = await create_issue(save_fixture, organization, repository)
    i2 = await create_issue(save_fixture, organization, repository)
    i3 = await create_issue(save_fixture, organization, repository)
    i4 = await create_issue(save_fixture, organization, repository)

    repository.pledge_badge_auto_embed = True
    organization.onboarded_at = utc_now()
    await save_fixture(organization)

    # Do not add, as badge has been manually removed
    i2.pledge_badge_ever_embedded = True
    await save_fixture(i2)

    # Do not add
    i3.pledge_badge_ever_embedded = True
    i3.pledge_badge_embedded_at = datetime.now(UTC)
    await save_fixture(i3)

    # then
    session.expunge_all()

    issues = await github_issue.list_issues_to_add_badge_to_auto(
        session, organization, repository
    )

    assert [i.id for i in issues] == [i1.id, i4.id]


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_list_issues_to_remove_badge_from_auto(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
) -> None:
    i1 = await create_issue(save_fixture, organization, repository)
    i2 = await create_issue(save_fixture, organization, repository)
    i3 = await create_issue(save_fixture, organization, repository)
    i4 = await create_issue(save_fixture, organization, repository)

    repository.pledge_badge_auto_embed = False
    organization.onboarded_at = utc_now()
    await save_fixture(organization)

    i2.pledge_badge_ever_embedded = True
    await save_fixture(i2)

    # Do not remove, as issue has label
    i3.has_pledge_badge_label = True
    i3.pledge_badge_embedded_at = datetime.now(UTC)
    i3.pledge_badge_ever_embedded = True
    await save_fixture(i3)

    # then
    session.expunge_all()

    issues = await github_issue.list_issues_to_remove_badge_from_auto(
        session, organization, repository
    )

    assert [i.id for i in issues] == [i1.id, i2.id, i4.id]
