from uuid import UUID

from fastapi import Depends, HTTPException, Query

from polar.auth.dependencies import WebUser, WebUserOrAnonymous
from polar.auth.models import Subject, is_user
from polar.authz.service import AccessType, Authz
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.issue.service import issue as issue_service
from polar.kit.pagination import ListResource, Pagination
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.service import repository as repository_service
from polar.routing import APIRouter
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    Pledge as PledgeSchema,
)
from .schemas import (
    PledgePledgesSummary,
    PledgeSpending,
)
from .service import pledge as pledge_service

router = APIRouter(tags=["pledges", APITag.private])


async def include_receiver_admin_fields(
    session: AsyncSession,
    subject: Subject,
    pledge: Pledge,
) -> bool:
    if not isinstance(subject, User):
        return False

    if not subject.id:
        return False

    # is member of receiver org
    if pledge.organization_id:
        m = await user_organization_service.get_by_user_and_org(
            session, subject.id, pledge.organization_id
        )
        if m:
            return True

    return False


async def include_sender_admin_fields(
    session: AsyncSession,
    subject: Subject,
    pledge: Pledge,
) -> bool:
    if not isinstance(subject, User):
        return False

    if not subject.id:
        return False

    # if is sender
    if pledge.by_user_id == subject.id:
        return True

    # is member of sending org
    if pledge.by_organization_id:
        m = await user_organization_service.get_by_user_and_org(
            session, subject.id, pledge.by_organization_id
        )
        if m:
            return True

    if pledge.on_behalf_of_organization_id:
        m = await user_organization_service.get_by_user_and_org(
            session, subject.id, pledge.on_behalf_of_organization_id
        )
        if m:
            return True

    return False


async def include_sender_fields(
    session: AsyncSession,
    subject: Subject,
    pledge: Pledge,
) -> bool:
    if not isinstance(subject, User):
        return False

    if not subject.id:
        return False

    # if is sender
    if pledge.by_user_id == subject.id:
        return True

    # is member if sending org
    if pledge.by_organization_id:
        if await user_organization_service.get_by_user_and_org(
            session, subject.id, pledge.by_organization_id
        ):
            return True

    if pledge.on_behalf_of_organization_id:
        if await user_organization_service.get_by_user_and_org(
            session, subject.id, pledge.on_behalf_of_organization_id
        ):
            return True

    return False


async def to_schema(session: AsyncSession, subject: Subject, p: Pledge) -> PledgeSchema:
    return PledgeSchema.from_db(
        p,
        include_receiver_admin_fields=await include_receiver_admin_fields(
            session, subject, p
        ),
        include_sender_admin_fields=await include_sender_admin_fields(
            session, subject, p
        ),
        include_sender_fields=await include_sender_fields(session, subject, p),
    )


@router.get(
    "/pledges/search",
    response_model=ListResource[PledgeSchema],
    description="Search pledges. Requires authentication. The user can only read pledges that they have made (personally or via an organization) or received (to organizations that they are a member of).",  # noqa: E501
    summary="Search pledges",
    status_code=200,
)
async def search(
    auth_subject: WebUserOrAnonymous,
    organization_id: OrganizationID | None = Query(
        None, description="Search pledges to this organization"
    ),
    repository_name: str | None = Query(
        default=None,
        min_length=1,
        examples=["my-repo"],
        description="Search pledges in the repository with this name. Can only be used if organization_name is set.",  # noqa: E501
    ),
    issue_id: UUID | None = Query(
        default=None, description="Search pledges to this issue"
    ),
    by_organization_id: UUID | None = Query(
        default=None, description="Search pledges made by this organization."
    ),
    by_user_id: UUID | None = Query(
        default=None, description="Search pledges made by this user."
    ),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[PledgeSchema]:
    list_by_orgs: list[UUID] = []
    list_by_repos: list[UUID] = []
    list_by_issues: list[UUID] = []

    if organization_id:
        # get org
        org = await organization_service.get(session, organization_id)

        if not org:
            raise HTTPException(
                status_code=404,
                detail="organization not found",
            )

        list_by_orgs = [org.id]

    if repository_name:
        if len(list_by_orgs) != 1:
            raise HTTPException(
                status_code=404,
                detail="organization not set",
            )

        repo = await repository_service.get_by_org_and_name(
            session, organization_id=list_by_orgs[0], name=repository_name
        )

        if not repo:
            raise HTTPException(
                status_code=404,
                detail="repository not found",
            )

        list_by_repos = [repo.id]

    # must be currently authenticated user
    if by_user_id:
        if not is_user(auth_subject) or auth_subject.subject.id != by_user_id:
            raise BadRequest("by_user_id must be the current authenticated users id")

    if issue_id:
        list_by_issues = [issue_id]

    if (
        len(list_by_orgs) == 0
        and len(list_by_repos) == 0
        and len(list_by_issues) == 0
        and not by_organization_id
        and not by_user_id
    ):
        raise HTTPException(
            status_code=400,
            detail="No search criteria specified",
        )

    pledges = await pledge_service.list_by(
        session=session,
        organization_ids=list_by_orgs,
        repository_ids=list_by_repos,
        issue_ids=list_by_issues,
        pledging_organization=by_organization_id,
        pledging_user=by_user_id,
        load_issue=True,
        load_pledger=True,
    )

    items = [
        await to_schema(session, auth_subject.subject, p)
        for p in pledges
        if await authz.can(auth_subject.subject, AccessType.read, p)
    ]

    return ListResource(
        items=items, pagination=Pagination(total_count=len(items), max_page=1)
    )


@router.get(
    "/pledges/summary",
    response_model=PledgePledgesSummary,
    description="Get summary of pledges for resource.",  # noqa: E501
    summary="Get pledges summary",
    status_code=200,
)
async def summary(
    issue_id: UUID,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PledgePledgesSummary:
    issue = await issue_service.get(session, issue_id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.read, issue):
        raise Unauthorized()

    return await pledge_service.issue_pledge_summary(session, issue)


@router.get(
    "/pledges/spending",
    response_model=PledgeSpending,
    description="Get current user spending in the current period. Used together with spending limits.",  # noqa: E501
    summary="Get user spending",
    status_code=200,
)
async def spending(
    auth_subject: WebUser,
    organization_id: UUID = Query(
        description="Spending in this organization. Required."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> PledgeSpending:
    res = await pledge_service.sum_pledges_period(
        session, organization_id, user_id=auth_subject.subject.id
    )
    return PledgeSpending(amount=res, currency="usd")


@router.get(
    "/pledges/{id}",
    response_model=PledgeSchema,
    description="Get a pledge. Requires authentication.",  # noqa: E501
    summary="Get pledge",
    status_code=200,
)
async def get(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PledgeSchema:
    pledge = await pledge_service.get_with_loaded(session, id)
    if not pledge:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.read, pledge):
        raise Unauthorized()

    return await to_schema(session, auth_subject.subject, pledge)


# Internal APIs below


@router.post(
    "/pledges/{id}/create_invoice",
    response_model=PledgeSchema,
    description="Creates an invoice for pay_on_completion pledges",
    status_code=200,
    tags=[APITag.private],
)
async def create_invoice(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PledgeSchema:
    pledge = await pledge_service.get(session, id)
    if not pledge:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, pledge):
        raise Unauthorized()

    await pledge_service.send_invoice(session, id)

    ret = await pledge_service.get_with_loaded(session, id)
    if not ret:
        raise ResourceNotFound()

    return await to_schema(session, auth_subject.subject, ret)


@router.post(
    "/pledges/{pledge_id}/dispute", response_model=PledgeSchema, tags=[APITag.private]
)
async def dispute_pledge(
    pledge_id: UUID,
    reason: str,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PledgeSchema:
    pledge = await pledge_service.get(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    # authorize
    user_memberships = await user_organization_service.list_by_user_id(
        session, auth_subject.subject.id
    )

    if not pledge_service.user_can_admin_sender_pledge(
        auth_subject.subject, pledge, user_memberships
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    await pledge_service.mark_disputed(
        session, pledge_id=pledge_id, by_user_id=auth_subject.subject.id, reason=reason
    )

    # get pledge again
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    return await to_schema(session, auth_subject.subject, pledge)
