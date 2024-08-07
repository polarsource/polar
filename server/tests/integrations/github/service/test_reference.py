import pytest
from pydantic import TypeAdapter

import polar.integrations.github.client as github
from polar.integrations.github import types
from polar.integrations.github.service.reference import (
    TimelineEventType,
    github_reference,
)
from polar.models import (
    ExternalOrganization,
    Issue,
    PullRequest,
    Repository,
)
from polar.models.issue_reference import ReferenceType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.vcr import read_cassette


@pytest.mark.asyncio
async def test_parse_repository_issues() -> None:
    raw = read_cassette("github/references/repo_issue_events.json")
    payload = TypeAdapter(list[types.IssueEvent]).validate_python(raw)
    issues_to_sync = github_reference.external_issue_ids_to_sync(payload)
    assert issues_to_sync == {1634181886}


@pytest.mark.asyncio
async def test_parse_issue_timeline(
    session: AsyncSession,
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    repository: Repository,
    issue: Issue,
    pull_request: PullRequest,
) -> None:
    raw = read_cassette("github/references/issue_timeline.json")
    payload = TypeAdapter(list[TimelineEventType]).validate_python(raw)

    # Create Org/Repo/Issue (setup to match names and ids in issue_timeline.json)
    external_organization.name = "zegloforko"
    external_organization.external_id = 456
    await save_fixture(external_organization)

    repository.name = "polarforkotest"
    repository.external_id = 617059064
    await save_fixture(repository)

    pull_request.number = 1
    pull_request.external_id = 1234
    await save_fixture(pull_request)

    client = github.get_client("fake")

    # then
    session.expunge_all()

    parsed = [
        await github_reference.parse_issue_timeline_event(
            session,
            external_organization,
            repository,
            issue,
            event,
            client=client,
        )
        for event in payload
    ]

    assert len(parsed) == 4

    if len(parsed) < 4:
        return

    assert parsed[0] is not None
    assert parsed[1] is not None
    assert parsed[2] is not None
    assert parsed[3] is not None

    assert parsed[0].external_id == "ed6882cdd95d8da95e993aee25ecac59b4663904"
    assert parsed[0].external_source is not None
    assert parsed[0].reference_type == ReferenceType.EXTERNAL_GITHUB_COMMIT

    assert str(parsed[1].pull_request_id) == str(pull_request.id)
    assert parsed[1].external_id == str(pull_request.id)
    assert parsed[1].reference_type == ReferenceType.PULL_REQUEST

    assert parsed[2].external_id == "53ea67e6b5ece5d3dbe8ec053ba0ffa57e693b61"
    assert parsed[2].reference_type == ReferenceType.EXTERNAL_GITHUB_COMMIT

    assert parsed[3].external_id == "471f58636e9b66228141d5e2c76be24f20f1553f"
    assert parsed[3].reference_type == ReferenceType.EXTERNAL_GITHUB_COMMIT


@pytest.mark.asyncio
async def test_parse_issue_timeline_rclone(
    session: AsyncSession,
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    repository: Repository,
    issue: Issue,
    pull_request: PullRequest,
) -> None:
    raw = read_cassette("github/references/issue_timeline_rclone.json")
    payload = TypeAdapter(list[TimelineEventType]).validate_python(raw)

    external_organization.name = "zegloforko"
    external_organization.external_id = 456
    await save_fixture(external_organization)

    repository.name = "polarforkotest"
    repository.external_id = 617059064
    await save_fixture(repository)

    pull_request.number = 1
    pull_request.external_id = 1234
    await save_fixture(pull_request)

    client = github.get_client("fake")

    # then
    session.expunge_all()

    parsed = [
        await github_reference.parse_issue_timeline_event(
            session,
            external_organization,
            repository,
            issue,
            event,
            client=client,
        )
        for event in payload
    ]

    assert len(parsed) == 4

    if len(parsed) < 4:
        return
