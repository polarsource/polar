import pytest
from polar.integrations.github.client import get_client
from polar.integrations.github.service.organization import github_organization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_sync_external_org_with_repo_and_issue(
    session: AsyncSession,
) -> None:
    client = get_client("")

    (
        org,
        repo,
        issue,
    ) = await github_organization.sync_external_org_with_repo_and_issue(
        session=session,
        client=client,
        org_name="polarsource",
        repo_name="open-testing",
        issue_number=8,
    )

    assert org is not None
    assert repo is not None
    assert issue is not None

    assert org.name == "polarsource"
    assert repo.name == "open-testing"

    # fetch again

    (
        org,
        repo,
        issue,
    ) = await github_organization.sync_external_org_with_repo_and_issue(
        session=session,
        client=client,
        org_name="POLARSOURCE",
        repo_name="Open-Testing",
        issue_number=8,
    )

    assert org is not None
    assert repo is not None
    assert issue is not None

    assert org.name == "polarsource"
    assert repo.name == "open-testing"
