from uuid import UUID

from fastapi import Depends

from polar.authz.dependencies import AuthorizeOrgManageRead, AuthorizeOrgManageUser
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import OrganizationDomain
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import OrganizationDomain as OrganizationDomainSchema
from .schemas import OrganizationDomainCreate
from .service import (
    OrganizationDomainAlreadyExists,
    OrganizationDomainVerificationFailed,
    OrganizationDomainVerifiedElsewhere,
)
from .service import organization_domain as organization_domain_service

router = APIRouter(
    prefix="/organizations/{id}/domains",
    tags=["organization_domains", APITag.private],
)

OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}

OrganizationDomainNotFound = {
    "description": "Organization or domain not found.",
    "model": ResourceNotFound.schema(),
}

NotPermittedResponse = {
    "description": "The user doesn't have the permission to manage the organization.",
    "model": NotPermitted.schema(),
}


@router.get(
    "/",
    summary="List Organization Domains",
    response_model=ListResource[OrganizationDomainSchema],
    responses={403: NotPermittedResponse, 404: OrganizationNotFound},
)
async def list_organization_domains(
    authz: AuthorizeOrgManageRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrganizationDomainSchema]:
    results, count = await organization_domain_service.list(
        session, authz.organization, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [OrganizationDomainSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    summary="Create Organization Domain",
    response_model=OrganizationDomainSchema,
    status_code=201,
    responses={
        403: NotPermittedResponse,
        404: OrganizationNotFound,
        409: {
            "description": "The domain is already added to this organization.",
            "model": OrganizationDomainAlreadyExists.schema(),
        },
    },
)
async def create_organization_domain(
    create: OrganizationDomainCreate,
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationDomain:
    return await organization_domain_service.create(session, authz.organization, create)


@router.delete(
    "/{domain_id}",
    summary="Delete Organization Domain",
    status_code=204,
    responses={403: NotPermittedResponse, 404: OrganizationDomainNotFound},
)
async def delete_organization_domain(
    domain_id: UUID,
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    organization_domain = await organization_domain_service.get(
        session, authz.organization, domain_id
    )
    if organization_domain is None:
        raise ResourceNotFound()
    await organization_domain_service.delete(session, organization_domain)


@router.post(
    "/{domain_id}/verify",
    summary="Verify Organization Domain",
    response_model=OrganizationDomainSchema,
    responses={
        400: {
            "description": "The DNS TXT record was not found.",
            "model": OrganizationDomainVerificationFailed.schema(),
        },
        403: NotPermittedResponse,
        404: OrganizationDomainNotFound,
        409: {
            "description": "Another organization already verified the domain.",
            "model": OrganizationDomainVerifiedElsewhere.schema(),
        },
    },
)
async def verify_organization_domain(
    domain_id: UUID,
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationDomain:
    organization_domain = await organization_domain_service.get(
        session, authz.organization, domain_id
    )
    if organization_domain is None:
        raise ResourceNotFound()
    return await organization_domain_service.verify(
        session, authz.organization, organization_domain
    )
