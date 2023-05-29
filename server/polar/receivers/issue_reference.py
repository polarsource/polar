from polar.issue.hooks import (
    IssueReferenceHook,
    issue_reference_created,
    issue_reference_updated,
)
from polar.issue.service import issue as issue_service


async def update_issue_state(hook: IssueReferenceHook):
    session = hook.session
    ref = hook.issue_reference

    issue = await issue_service.get_by_id(session, ref.issue_id)
    if not issue:
        return

    await issue_service.update_issue_reference_state(session, issue)


issue_reference_created.add(update_issue_state)
issue_reference_updated.add(update_issue_state)
