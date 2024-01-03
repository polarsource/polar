import pytest
from pydantic import parse_obj_as

import polar.integrations.github.client as github
from polar.integrations.github.service.reference import (
    TimelineEventType,
    github_reference,
)
from polar.models.issue import Issue
from polar.models.issue_reference import ReferenceType
from polar.models.organization import Organization
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.postgres import AsyncSession
from tests.fixtures.vcr import read_cassette


@pytest.mark.asyncio
async def test_parse_repository_issues() -> None:
    raw = read_cassette("github/references/repo_issue_events.json")
    payload = parse_obj_as(list[github.rest.IssueEvent], raw)
    issues_to_sync = github_reference.external_issue_ids_to_sync(payload)
    assert issues_to_sync == {1634181886}


@pytest.mark.asyncio
async def test_parse_issue_timeline(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    pull_request: PullRequest,
) -> None:
    raw = read_cassette("github/references/issue_timeline.json")
    payload = parse_obj_as(list[TimelineEventType], raw)

    # Create Org/Repo/Issue (setup to match names and ids in issue_timeline.json)
    organization.name = "zegloforko"
    organization.external_id = 456
    await organization.save(session)

    repository.name = "polarforkotest"
    repository.external_id = 617059064
    await repository.save(session)

    pull_request.number = 1
    pull_request.external_id = 1234
    await pull_request.save(session)
    await session.commit()
    await session.flush()

    client = github.get_client("fake")

    # then
    session.expunge_all()

    parsed = [
        await github_reference.parse_issue_timeline_event(
            session,
            organization,
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
