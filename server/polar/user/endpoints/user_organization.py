from typing import Sequence

from fastapi import APIRouter, Depends

from polar.auth.dependencies import current_active_user
from polar.models import Organization, User
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization
from polar.repository.service import repository
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import RepositoryRead
from polar.integrations.github.service.user import github_user

router = APIRouter(prefix="/user/organizations", tags=["user.organizations"])


@router.get("", response_model=list[OrganizationRead])
async def get_user_organizations(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[OrganizationRead]:
    # get list of orgs that the user can see
    user_orgs = await github_user.user_accessible_orgs(session, user)

    # fetch orgs
    orgs = [await organization.get(session, o.organization_id) for o in user_orgs]

    async def expand_children(org: Organization) -> OrganizationRead:
        # get the repositories in this org that the user can access
        user_repos = await github_user.user_accessible_repos(session, user, org)

        # fetch as repo
        repos = [await repository.get(session, r.repository_id) for r in user_repos]

        o = OrganizationRead.from_orm(org)
        o.repositories = [RepositoryRead.from_orm(repo) for repo in repos]
        return o

    return [await expand_children(org) for org in orgs if org]
