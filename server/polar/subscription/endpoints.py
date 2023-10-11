from fastapi import APIRouter, Depends
from pydantic import UUID4

from polar.auth.dependencies import UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import SubscriptionGroup
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import SubscriptionGroup as SubscriptionGroupSchema
from .schemas import SubscriptionGroupCreate, SubscriptionGroupUpdate
from .service.subscription_group import subscription_group as subscription_group_service

router = APIRouter(prefix="/subscriptions", tags=["subscription"])


@router.post(
    "/groups/",
    response_model=SubscriptionGroupSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_subscription_group(
    subscription_group_create: SubscriptionGroupCreate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionGroup:
    return await subscription_group_service.user_create(
        session, authz, subscription_group_create, auth.user
    )


@router.post("/groups/{id}", response_model=SubscriptionGroupSchema, tags=[Tags.PUBLIC])
async def update_subscription_group(
    id: UUID4,
    subscription_group_update: SubscriptionGroupUpdate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionGroup:
    subscription_group = (
        await subscription_group_service.get_with_organization_or_repository(
            session, id
        )
    )

    if subscription_group is None:
        raise ResourceNotFound()

    if not await authz.can(auth.user, AccessType.write, subscription_group):
        raise NotPermitted()

    return await subscription_group_service.update(
        session, subscription_group, subscription_group_update, exclude_unset=True
    )
