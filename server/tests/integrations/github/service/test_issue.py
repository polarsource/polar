import pytest

from polar.integrations.github.client import get_client
from polar.integrations.github.service.issue import github_issue
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_sync_external_org_with_repo_and_issue(
    session: AsyncSession,
) -> None:
    client = get_client("")

    # then
    session.expunge_all()

    issue = await github_issue.sync_external_org_with_repo_and_issue(
        session=session,
        client=client,
        org_name="polarsource",
        repo_name="open-testing",
        issue_number=8,
    )

    assert issue is not None

    # fetch again

    issue = await github_issue.sync_external_org_with_repo_and_issue(
        session=session,
        client=client,
        org_name="POLARSOURCE",
        repo_name="Open-Testing",
        issue_number=8,
    )

    assert issue is not None
