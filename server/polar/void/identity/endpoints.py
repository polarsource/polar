from collections.abc import Sequence

from fastapi import Depends, Query, Response

from polar.exceptions import ResourceNotFound
from polar.models import VoidBillingIdentity
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidCustomerRead, VoidRead, VoidWrite
from polar.void.entitlement.schemas import (
    EntitlementAssignmentRead,
    EntitlementUpdate,
    IdentityEntitlements,
)
from polar.void.entitlement.service import (
    EntitlementAssignmentConflict,
    EntitlementAssignmentInvalid,
)
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.organization.service import selected_version
from polar.void.postgres import get_snapshot_session
from polar.void.subscription.service import subscription as subscription_service
from polar.void.tinybird import TinybirdClient

from .schemas import Identity, IdentityCreate, IdentityDetail, IdentitySnapshot
from .service import DeletedIdentityConflict, IdentityHierarchyConflict
from .service import identity as identity_service
from .snapshot import snapshot as snapshot_service

router = APIRouter(prefix="/identities", tags=["identities"], include_in_schema=False)


@router.get(
    "",
    response_model=list[Identity],
    operation_id="identities:list",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def list_identities(
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    parent: str | None = Query(None, description="Only children of this identity"),
    root: bool = Query(False, description="Only identities with no parent"),
) -> Sequence[VoidBillingIdentity]:
    return await identity_service.list(session, auth_subject.subject.id, parent, root)


@router.post(
    "",
    response_model=Identity,
    operation_id="identities:ensure",
    responses={
        201: {"model": Identity},
        404: {"model": ResourceNotFound.schema()},
        409: {
            "model": DeletedIdentityConflict.schema()
            | IdentityHierarchyConflict.schema()
        },
    },
)
async def ensure_identity(
    body: IdentityCreate,
    response: Response,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> VoidBillingIdentity:
    result, created = await identity_service.ensure(session, auth_subject.subject, body)
    response.status_code = 201 if created else 200
    return result


@router.get(
    "/{external_id}",
    response_model=IdentityDetail,
    operation_id="identities:get",
    responses={
        404: {"model": ResourceNotFound.schema()},
        409: {"model": IdentityHierarchyConflict.schema()},
    },
)
async def get_identity(
    external_id: str,
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> IdentityDetail:
    result = await identity_service.get(session, auth_subject.subject.id, external_id)
    chain = await identity_service.chain(session, result)
    children = await identity_service.children(session, result)
    return IdentityDetail.model_validate(
        {
            **Identity.model_validate(result).model_dump(),
            "chain": [node.external_id for node in chain],
            "children": children,
        }
    )


@router.get(
    "/{external_id}/snapshot",
    response_model=IdentitySnapshot,
    operation_id="identities:snapshot",
    responses={
        404: {"model": ResourceNotFound.schema()},
        409: {"model": IdentityHierarchyConflict.schema()},
    },
)
async def snapshot(
    external_id: str,
    auth_subject: VoidCustomerRead,
    tinybird: TinybirdClient,
    version_id: str | None = None,
    session: AsyncSession = Depends(get_snapshot_session),
) -> IdentitySnapshot:
    return await snapshot_service.get(
        session,
        tinybird,
        auth_subject,
        external_id,
        await selected_version(session, auth_subject.subject.id, version_id),
    )


@router.get(
    "/{external_id}/entitlements",
    response_model=IdentityEntitlements,
    operation_id="identities:entitlements",
    responses={
        404: {"model": ResourceNotFound.schema()},
        409: {"model": IdentityHierarchyConflict.schema()},
    },
)
async def entitlements(
    external_id: str,
    auth_subject: VoidRead,
    session: AsyncSession = Depends(get_snapshot_session),
) -> IdentityEntitlements:
    return await subscription_service.held(
        session, auth_subject.subject.id, external_id
    )


@router.put(
    "/{external_id}/entitlements",
    response_model=EntitlementAssignmentRead,
    operation_id="identities:assignEntitlements",
    responses={
        400: {"model": EntitlementAssignmentInvalid.schema()},
        404: {"model": ResourceNotFound.schema()},
        409: {
            "model": EntitlementAssignmentConflict.schema()
            | IdentityHierarchyConflict.schema()
        },
    },
)
async def assign_entitlements(
    external_id: str,
    body: EntitlementUpdate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> EntitlementAssignmentRead:
    assignment = await entitlement_service.assign(
        session, auth_subject.subject.id, external_id, body
    )
    return EntitlementAssignmentRead.model_validate(assignment.model_dump())
