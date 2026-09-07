from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import Model


class UserSessionOrganization(Model):
    """Down-scopes a `UserSession` to a subset of the user's organizations.

    No rows for a session means *unrestricted* (all the user's organizations,
    resolved live). When rows exist, the session may only act on those
    organizations — always intersected with the user's current membership.

    ``sso`` records whether the down-scope originated from an SSO completion:
    only SSO-provenanced scopes satisfy the "proof SSO works" guard that gates
    enabling ``sso_enforced``. Backoffice impersonation and any other
    non-SSO flow that scopes a session leave it ``False``.
    """

    __tablename__ = "user_session_organizations"

    user_session_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("user_sessions.id", ondelete="cascade"),
        primary_key=True,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        primary_key=True,
    )
    sso: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
