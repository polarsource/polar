from polar.context import PolarContext
from polar.models.issue_reference import IssueReference
from polar.postgres import AsyncSession
from polar.issue.signals import issue_reference_created, issue_reference_updated
from polar.issue.service import issue as issue_service


@issue_reference_created.connect
async def issue_reference_created_action(
    context: PolarContext, *, item: IssueReference, session: AsyncSession
):
    await update_issue_state(item, session)


@issue_reference_updated.connect
async def issue_reference_updated_action(
    context: PolarContext, *, item: IssueReference, session: AsyncSession
):
    await update_issue_state(item, session)


async def update_issue_state(ref: IssueReference, session: AsyncSession):
    issue = await issue_service.get_by_id(session, ref.issue_id)
    if not issue:
        return

    await issue_service.update_issue_reference_state(session, issue)
