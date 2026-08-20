from uuid import UUID

from fastapi import Depends, Query

from polar.customer.schemas.customer import CustomerID, ExternalCustomerID
from polar.exceptions import NotPermitted, PolarRequestValidationError, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models.member import MemberRole
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import (
    ExternalMemberID,
    Member,
    MemberCreate,
    MemberCreateFromCustomer,
    MemberUpdate,
)
from .service import AmbiguousExternalCustomerID, member_service

router = APIRouter(
    prefix="/members",
    tags=["members"],
)

# Nested router: the new customer-scoped member CRUD, mounted under
# /v1/customers/{id}/members. Lives in the member module (logic ownership) but
# is grouped under `customers.members` in the SDK via its tags.
customer_members_router = APIRouter(
    prefix="/customers",
    tags=["customers", "members", APITag.public],
)

MemberNotFound = {
    "description": "Member not found.",
    "model": ResourceNotFound.schema(),
}

CustomerNotFound = {
    "description": "Customer not found.",
    "model": ResourceNotFound.schema(),
}

NotPermittedToAddMembers = {
    "description": "Not permitted to add members.",
    "model": NotPermitted.schema(),
}

AmbiguousExternalCustomer = {
    "description": "The external customer ID matches customers in several "
    "accessible organizations.",
    "model": AmbiguousExternalCustomerID.schema(),
}


def _validate_customer_id_params(
    customer_id: UUID | None, external_customer_id: str | None
) -> None:
    if customer_id is None and external_customer_id is None:
        raise PolarRequestValidationError(
            [
                {
                    "type": "missing",
                    "loc": ("query",),
                    "msg": "One of customer_id or external_customer_id must be provided.",
                    "input": None,
                }
            ]
        )
    if customer_id is not None and external_customer_id is not None:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("query",),
                    "msg": "Only one of customer_id or external_customer_id may be provided.",
                    "input": None,
                }
            ]
        )


@router.get(
    "/",
    summary="List Members",
    tags=[APITag.public],
    response_model=ListResource[Member],
)
async def list_members(
    auth_subject: auth.MemberRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    customer_id: str | None = Query(None, description="Filter by customer ID."),
    external_customer_id: ExternalCustomerID | None = Query(
        None, description="Filter by customer external ID."
    ),
    role: MemberRole | None = Query(None, description="Filter by member role."),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[Member]:
    """List members with optional customer ID filter."""
    parsed_customer_id = None
    if customer_id is not None:
        try:
            parsed_customer_id = UUID(customer_id)
        except ValueError:
            raise ResourceNotFound("Invalid customer ID format")

    results, count = await member_service.list(
        session,
        auth_subject,
        customer_id=parsed_customer_id,
        external_customer_id=external_customer_id,
        role=role,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [Member.model_validate(member) for member in results],
        count,
        pagination,
    )


# --- Nested customer-scoped endpoints ---------------------------------------


@customer_members_router.post(
    "/{id}/members",
    response_model=Member,
    status_code=201,
    summary="Create Member",
    responses={
        201: {"description": "Member created."},
        403: NotPermittedToAddMembers,
        404: CustomerNotFound,
    },
)
async def create(
    id: CustomerID,
    member_create: MemberCreateFromCustomer,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """
    Create a new member for a customer.

    Only B2B customers with the member management feature enabled can add members.
    The authenticated user or organization must have access to the customer's organization.
    """
    created_member = await member_service.create(
        session,
        auth_subject,
        customer_id=id,
        email=member_create.email,
        name=member_create.name,
        external_id=member_create.external_id,
        role=member_create.role,
    )

    return Member.model_validate(created_member)


@customer_members_router.post(
    "/external/{external_id}/members",
    response_model=Member,
    status_code=201,
    summary="Create Member by Customer External ID",
    responses={
        201: {"description": "Member created."},
        403: NotPermittedToAddMembers,
        404: CustomerNotFound,
        409: AmbiguousExternalCustomer,
    },
)
async def create_external(
    external_id: ExternalCustomerID,
    member_create: MemberCreateFromCustomer,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """Create a new member for a customer identified by its external ID."""
    created_member = await member_service.create(
        session,
        auth_subject,
        external_customer_id=external_id,
        email=member_create.email,
        name=member_create.name,
        external_id=member_create.external_id,
        role=member_create.role,
    )

    return Member.model_validate(created_member)


@customer_members_router.get(
    "/{id}/members/{member_id}",
    summary="Get Member",
    response_model=Member,
    responses={
        200: {"description": "Member retrieved."},
        404: MemberNotFound,
    },
)
async def get(
    id: CustomerID,
    member_id: UUID,
    auth_subject: auth.MemberRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Member:
    """Get a member of a customer by its ID."""
    member = await member_service.get_for_customer(session, auth_subject, id, member_id)
    if member is None:
        raise ResourceNotFound("Member not found")

    return Member.model_validate(member)


@customer_members_router.get(
    "/external/{external_id}/members/{member_external_id}",
    summary="Get Member by External ID",
    response_model=Member,
    responses={
        200: {"description": "Member retrieved."},
        404: MemberNotFound,
        409: AmbiguousExternalCustomer,
    },
)
async def get_external(
    external_id: ExternalCustomerID,
    member_external_id: ExternalMemberID,
    auth_subject: auth.MemberRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Member:
    """Get a member by external ID for a customer identified by its external ID."""
    member = await member_service.get_by_external_id(
        session,
        auth_subject,
        member_external_id,
        external_customer_id=external_id,
    )
    if member is None:
        raise ResourceNotFound("Member not found")

    return Member.model_validate(member)


@customer_members_router.patch(
    "/{id}/members/{member_id}",
    summary="Update Member",
    response_model=Member,
    responses={
        200: {"description": "Member updated."},
        404: MemberNotFound,
    },
)
async def update(
    id: CustomerID,
    member_id: UUID,
    member_update: MemberUpdate,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """
    Update a member of a customer.

    Only name, email and role can be updated.
    """
    member = await member_service.get_for_customer(session, auth_subject, id, member_id)
    if member is None:
        raise ResourceNotFound("Member not found")

    updated_member = await member_service.update(
        session,
        member,
        name=member_update.name,
        role=member_update.role,
        email=member_update.email,
        allow_ownership_transfer=True,
    )

    return Member.model_validate(updated_member)


@customer_members_router.patch(
    "/external/{external_id}/members/{member_external_id}",
    summary="Update Member by External ID",
    response_model=Member,
    responses={
        200: {"description": "Member updated."},
        404: MemberNotFound,
        409: AmbiguousExternalCustomer,
    },
)
async def update_external(
    external_id: ExternalCustomerID,
    member_external_id: ExternalMemberID,
    member_update: MemberUpdate,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """Update a member by external ID for a customer identified by its external ID."""
    member = await member_service.get_by_external_id(
        session,
        auth_subject,
        member_external_id,
        external_customer_id=external_id,
    )
    if member is None:
        raise ResourceNotFound("Member not found")

    updated_member = await member_service.update(
        session,
        member,
        name=member_update.name,
        role=member_update.role,
        email=member_update.email,
        allow_ownership_transfer=True,
    )

    return Member.model_validate(updated_member)


@customer_members_router.delete(
    "/{id}/members/{member_id}",
    status_code=204,
    summary="Delete Member",
    responses={
        204: {"description": "Member deleted."},
        404: MemberNotFound,
    },
)
async def delete(
    id: CustomerID,
    member_id: UUID,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a member of a customer."""
    member = await member_service.get_for_customer(session, auth_subject, id, member_id)
    if member is None:
        raise ResourceNotFound("Member not found")

    await member_service.delete(session, member)


@customer_members_router.delete(
    "/external/{external_id}/members/{member_external_id}",
    status_code=204,
    summary="Delete Member by External ID",
    responses={
        204: {"description": "Member deleted."},
        404: MemberNotFound,
        409: AmbiguousExternalCustomer,
    },
)
async def delete_external(
    external_id: ExternalCustomerID,
    member_external_id: ExternalMemberID,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a member by external ID for a customer identified by its external ID."""
    member = await member_service.get_by_external_id(
        session,
        auth_subject,
        member_external_id,
        external_customer_id=external_id,
    )
    if member is None:
        raise ResourceNotFound("Member not found")

    await member_service.delete(session, member)


# --- Deprecated customer-scoped endpoints -----------------------------------
# Superseded by the nested /v1/customers/{id}/members routes above. Kept for
# backwards compatibility (APITag.private removes them from the public SDK).


@router.post(
    "/",
    response_model=Member,
    status_code=201,
    summary="Create Member",
    tags=[APITag.private],
    deprecated=True,
    responses={
        201: {"description": "Member created."},
        403: {"description": "Not permitted to add members."},
        404: MemberNotFound,
    },
)
async def create_member(
    member_create: MemberCreate,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """
    Create a new member for a customer.

    Only B2B customers with the member management feature enabled can add members.
    The authenticated user or organization must have access to the customer's organization.
    """
    created_member = await member_service.create(
        session,
        auth_subject,
        customer_id=member_create.customer_id,
        email=member_create.email,
        name=member_create.name,
        external_id=member_create.external_id,
        role=member_create.role,
    )

    return Member.model_validate(created_member)


@router.get(
    "/{id}",
    summary="Get Member",
    response_model=Member,
    tags=[APITag.private],
    deprecated=True,
    responses={
        200: {"description": "Member retrieved."},
        404: MemberNotFound,
    },
)
async def get_member(
    id: UUID,
    auth_subject: auth.MemberRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Member:
    """
    Get a member by ID.

    The authenticated user or organization must have access to the member's organization.
    """
    member = await member_service.get(session, auth_subject, id)

    if member is None:
        raise ResourceNotFound("Member not found")

    return Member.model_validate(member)


@router.get(
    "/external/{external_id}",
    summary="Get Member by External ID",
    response_model=Member,
    tags=[APITag.private],
    deprecated=True,
    responses={
        200: {"description": "Member retrieved."},
        404: MemberNotFound,
    },
)
async def get_member_by_external_id(
    external_id: ExternalMemberID,
    auth_subject: auth.MemberRead,
    customer_id: UUID | None = Query(None, description="The customer ID."),
    external_customer_id: str | None = Query(
        None, description="The customer external ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Member:
    """Get a member by external ID. One of customer_id or external_customer_id must be specified."""
    _validate_customer_id_params(customer_id, external_customer_id)

    member = await member_service.get_by_external_id(
        session,
        auth_subject,
        external_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
    )

    if member is None:
        raise ResourceNotFound("Member not found")

    return Member.model_validate(member)


@router.patch(
    "/{id}",
    summary="Update Member",
    response_model=Member,
    tags=[APITag.private],
    deprecated=True,
    responses={
        200: {"description": "Member updated."},
        404: MemberNotFound,
    },
)
async def update_member(
    id: UUID,
    member_update: MemberUpdate,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """
    Update a member.

    Only name, email and role can be updated.
    The authenticated user or organization must have access to the member's organization.
    """
    member = await member_service.get(session, auth_subject, id)

    if member is None:
        raise ResourceNotFound("Member not found")

    updated_member = await member_service.update(
        session,
        member,
        name=member_update.name,
        role=member_update.role,
        email=member_update.email,
        allow_ownership_transfer=True,
    )

    return Member.model_validate(updated_member)


@router.patch(
    "/external/{external_id}",
    summary="Update Member by External ID",
    response_model=Member,
    tags=[APITag.private],
    deprecated=True,
    responses={
        200: {"description": "Member updated."},
        404: MemberNotFound,
    },
)
async def update_member_by_external_id(
    external_id: ExternalMemberID,
    member_update: MemberUpdate,
    auth_subject: auth.MemberWrite,
    customer_id: UUID | None = Query(None, description="The customer ID."),
    external_customer_id: str | None = Query(
        None, description="The customer external ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """Update a member by external ID. One of customer_id or external_customer_id must be specified."""
    _validate_customer_id_params(customer_id, external_customer_id)

    member = await member_service.get_by_external_id(
        session,
        auth_subject,
        external_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
    )

    if member is None:
        raise ResourceNotFound("Member not found")

    updated_member = await member_service.update(
        session,
        member,
        name=member_update.name,
        role=member_update.role,
        email=member_update.email,
        allow_ownership_transfer=True,
    )

    return Member.model_validate(updated_member)


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Member",
    tags=[APITag.private],
    deprecated=True,
    responses={
        204: {"description": "Member deleted."},
        404: MemberNotFound,
    },
)
async def delete_member(
    id: UUID,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a member.

    The authenticated user or organization must have access to the member's organization.
    """
    member = await member_service.get(session, auth_subject, id)

    if member is None:
        raise ResourceNotFound("Member not found")

    await member_service.delete(session, member)


@router.delete(
    "/external/{external_id}",
    status_code=204,
    summary="Delete Member by External ID",
    tags=[APITag.private],
    deprecated=True,
    responses={
        204: {"description": "Member deleted."},
        404: MemberNotFound,
    },
)
async def delete_member_by_external_id(
    external_id: ExternalMemberID,
    auth_subject: auth.MemberWrite,
    customer_id: UUID | None = Query(None, description="The customer ID."),
    external_customer_id: str | None = Query(
        None, description="The customer external ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a member by external ID. One of customer_id or external_customer_id must be specified."""
    _validate_customer_id_params(customer_id, external_customer_id)

    member = await member_service.get_by_external_id(
        session,
        auth_subject,
        external_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
    )

    if member is None:
        raise ResourceNotFound("Member not found")

    await member_service.delete(session, member)
