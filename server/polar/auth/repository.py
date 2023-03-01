from polar.actions import organization
from polar.models.repository import Repository
from polar.models.user import User
from polar.postgres import AsyncSession


class RepositoryAuth:
    async def can_write(
        self, session: AsyncSession, user: User, repo: Repository
    ) -> bool:
        # If user is member of organization, they can write
        orgs = await organization.get_all_by_user_id(session, user.id)
        ids = [org.id for org in orgs]
        if repo.organization_id in ids:
            return True
        return False


repository_auth = RepositoryAuth()
