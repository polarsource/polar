from polar.actions import organization
from polar.models.issue import Issue
from polar.models.user import User
from polar.postgres import AsyncSession


class IssueAuth:
    async def can_write(session: AsyncSession, user: User, issue: Issue) -> bool:
        # If user is member of organization, they can write
        orgs = await organization.get_all_by_user_id(session, user.id)
        ids = [org.id for org in orgs]
        if issue.organization_id in ids:
            return True
        return False
