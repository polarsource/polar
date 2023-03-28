from polar.issue.signals import issue_updated
from polar.models import Issue

from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession


@issue_updated.connect  # type: ignore
async def mark_pledges_pending_on_issue_close(issue: Issue, session: AsyncSession):
    print("MARK PLEDGES PENDING ON ISSUE CLOSE", issue)
    if issue.state == "closed":
        await pledge_service.mark_pending_by_issue_id(session, issue.id)
