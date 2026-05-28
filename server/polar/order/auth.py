from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.auth.scope import Scope
from polar.authz.service import assert_resource_permission
from polar.exceptions import ResourceNotFound
from polar.models import Order
from polar.postgres import AsyncSession, get_db_session

from .schemas import OrderID
from .service import order as order_service

_OrdersRead = Authenticator(
    required_scopes={Scope.orders_read},
    allowed_subjects={User, Organization},
)
OrdersRead = Annotated[AuthSubject[User | Organization], Depends(_OrdersRead)]

_OrdersWrite = Authenticator(
    required_scopes={
        Scope.orders_write,
    },
    allowed_subjects={User, Organization},
)
OrdersWrite = Annotated[AuthSubject[User | Organization], Depends(_OrdersWrite)]


@dataclass(frozen=True)
class AuthorizedOrder:
    """Result of an OrderPolicyGuard dependency: the resolved order plus the
    authenticated subject."""

    order: Order
    auth_subject: AuthSubject[User | Organization]


def OrderPolicyGuard(permission: OrganizationPermission) -> Any:
    """FastAPI dependency: authenticate (orders:write), resolve the order from
    the ``{id}`` path parameter scoped to the subject's organizations, and
    assert ``permission`` on its organization.

    Raises:
        Unauthorized (401): No valid credentials / disallowed subject type.
        InsufficientScopeError (403): The token lacks ``orders:write``.
        ResourceNotFound (404): The order doesn't exist or isn't accessible to
            the subject (gated before the permission check so we don't leak the
            existence of orders in other organizations).
        NotPermitted (403): The subject is a member but lacks ``permission``.
    """

    async def dependency(
        id: OrderID,
        auth_subject: OrdersWrite,
        session: AsyncSession = Depends(get_db_session),
    ) -> AuthorizedOrder:
        order = await order_service.get(session, auth_subject, id)
        if order is None:
            raise ResourceNotFound()
        await assert_resource_permission(session, auth_subject, order, permission)
        return AuthorizedOrder(order=order, auth_subject=auth_subject)

    return dependency


OrderSalesManage = Annotated[
    AuthorizedOrder,
    Depends(OrderPolicyGuard(OrganizationPermission.sales_manage)),
]
