from uuid import UUID

from fastapi import Depends

from polar.authz.dependencies import AuthorizeOrgManageRead, AuthorizeOrgManageUser
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import OrganizationSSOConnection
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import (
    OrganizationSSOConnection as OrganizationSSOConnectionSchema,
)
from .schemas import (
    OrganizationSSOConnectionCreate,
    OrganizationSSOConnectionUpdate,
)
from .service import (
    organization_sso_connection as organization_sso_connection_service,
)

router = APIRouter(
    prefix="/organizations/{id}/sso-connections",
    tags=["sso", APITag.private],
)

OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}

SSOConnectionNotFound = {
    "description": "Organization or SSO connection not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List SSO Connections",
    response_model=ListResource[OrganizationSSOConnectionSchema],
    responses={404: OrganizationNotFound},
)
async def list_sso_connections(
    authz: AuthorizeOrgManageRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrganizationSSOConnectionSchema]:
    results, count = await organization_sso_connection_service.list(
        session, authz.organization, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [OrganizationSSOConnectionSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{connection_id}",
    summary="Get SSO Connection",
    response_model=OrganizationSSOConnectionSchema,
    responses={404: SSOConnectionNotFound},
)
async def get_sso_connection(
    connection_id: UUID,
    authz: AuthorizeOrgManageRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationSSOConnection:
    connection = await organization_sso_connection_service.get(
        session, authz.organization, connection_id
    )
    if connection is None:
        raise ResourceNotFound()
    return connection


@router.post(
    "/",
    summary="Create SSO Connection",
    response_model=OrganizationSSOConnectionSchema,
    status_code=201,
    responses={404: OrganizationNotFound},
)
async def create_sso_connection(
    create: OrganizationSSOConnectionCreate,
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSSOConnection:
    return await organization_sso_connection_service.create(
        session, authz.organization, create
    )


@router.patch(
    "/{connection_id}",
    summary="Update SSO Connection",
    response_model=OrganizationSSOConnectionSchema,
    responses={404: SSOConnectionNotFound},
)
async def update_sso_connection(
    connection_id: UUID,
    update: OrganizationSSOConnectionUpdate,
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSSOConnection:
    connection = await organization_sso_connection_service.get(
        session, authz.organization, connection_id
    )
    if connection is None:
        raise ResourceNotFound()
    return await organization_sso_connection_service.update(session, connection, update)


@router.delete(
    "/{connection_id}",
    summary="Delete SSO Connection",
    status_code=204,
    responses={404: SSOConnectionNotFound},
)
async def delete_sso_connection(
    connection_id: UUID,
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    connection = await organization_sso_connection_service.get(
        session, authz.organization, connection_id
    )
    if connection is None:
        raise ResourceNotFound()
    await organization_sso_connection_service.delete(session, connection)
