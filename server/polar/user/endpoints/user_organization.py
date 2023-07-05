from typing import Sequence

from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.models import Organization
from polar.organization.endpoints import OrganizationPrivateRead
from polar.organization.service import organization
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import RepositoryLegacyRead

router = APIRouter(prefix="/user/organizations", tags=["user.organizations"])


@router.get("", response_model=Sequence[OrganizationPrivateRead], deprecated=True)
async def get_user_organizations(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[OrganizationPrivateRead]:
    orgs = await organization.get_all_org_repos_by_user_id(session, auth.user.id)

    # Fast API doesn't support nested schemas yet, so we have to do this manually
    # See https://github.com/tiangolo/fastapi/issues/1645
    def expand_children(org: Organization) -> OrganizationPrivateRead:
        o = OrganizationPrivateRead.from_orm(org)

        o.repositories = [
            RepositoryLegacyRead.from_orm(repo)
            for repo in org.repos
            if repo.organization_id == org.id
        ]
        return o

    return [expand_children(org) for org in orgs]
