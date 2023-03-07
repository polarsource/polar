from typing import Sequence

from fastapi import APIRouter, Depends

from polar.auth.dependencies import current_active_user
from polar.models import Organization, User
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import RepositoryRead

router = APIRouter()


@router.get("", response_model=list[OrganizationRead])
async def get_user_organizations(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[OrganizationRead]:
    orgs = await organization.get_all_org_repos_by_user_id(session, user.id)

    # Fast API doesn't support nested schemas yet, so we have to do this manually
    # See https://github.com/tiangolo/fastapi/issues/1645
    def expand_children(org: Organization) -> OrganizationRead:
        o = OrganizationRead.from_orm(org)
        o.repositories = [
            RepositoryRead.from_orm(repo)
            for repo in org.repos
            if repo.organization_id == org.id
        ]
        return o

    return [expand_children(org) for org in orgs]
