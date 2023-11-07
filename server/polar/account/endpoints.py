from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from polar.auth.dependencies import UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.enums import AccountType
from polar.kit.pagination import ListResource, Pagination
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import Account, AccountCreate, AccountLink
from .service import account as account_service

router = APIRouter(tags=["accounts"])


@router.get(
    "/accounts/search", tags=[Tags.PUBLIC], response_model=ListResource[Account]
)
async def search(
    auth: UserRequiredAuth,
    organization_id: UUID | None = Query(
        default=None,
        description="Search accounts connected to this organization. Either user_id or organization_id must be set.",  # noqa: E501
    ),
    user_id: UUID | None = Query(
        default=None,
        description="Search accounts connected to this user. Either user_id or organization_id must be set.",  # noqa: E501
    ),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[Account]:
    if not organization_id and not user_id:
        raise HTTPException(
            status_code=400, detail="Either organization_id or user_id must be set"
        )

    accs = await account_service.list_by(
        session, org_id=organization_id, user_id=user_id
    )

    items = [
        Account.from_db(a)
        for a in accs
        if await authz.can(auth.subject, AccessType.read, a)
    ]
    return ListResource(
        items=items, pagination=Pagination(total_count=len(items), max_page=1)
    )


@router.get("/accounts/{id}", tags=[Tags.PUBLIC], response_model=Account)
async def get(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    acc = await account_service.get(session, id)
    if not acc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if not await authz.can(auth.subject, AccessType.read, acc):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    return Account.from_db(acc)


@router.post(
    "/accounts/{id}/onboarding_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def onboarding_link(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get(session, id)
    if not acc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if not await authz.can(auth.subject, AccessType.write, acc):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    if acc.account_type == AccountType.open_collective:
        raise HTTPException(
            status_code=404, detail="Open collective have no onboarding links"
        )

    link = await account_service.onboarding_link(acc)
    if not link:
        raise HTTPException(status_code=500, detail="Failed to create link")

    return link


@router.post(
    "/accounts/{id}/dashboard_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def dashboard_link(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get(session, id)
    if not acc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if not await authz.can(auth.subject, AccessType.write, acc):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    link = await account_service.dashboard_link(acc)
    if not link:
        raise HTTPException(status_code=500, detail="Failed to create link")

    return link


@router.post("/accounts", tags=[Tags.PUBLIC], response_model=Account)
async def create(
    account: AccountCreate,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    if account.organization_id:
        org = await organization_service.get(session, account.organization_id)
        if not org or not await authz.can(auth.subject, AccessType.write, org):
            raise HTTPException(
                status_code=401,
                detail="Unauthorized",
            )

    if account.user_id and str(account.user_id) != str(auth.user.id):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    created = await account_service.create_account(
        session,
        organization_id=account.organization_id,
        user_id=account.user_id,
        admin_id=auth.user.id,
        account=account,
    )

    return Account.from_db(created)
