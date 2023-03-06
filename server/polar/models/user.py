from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import GUID
from polar.platforms import Platforms

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.organization import Organization
    from polar.models.user_organization import UserOrganization


class OAuthAccount(RecordModel):
    __tablename__ = "oauth_accounts"

    oauth_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    access_token: Mapped[str] = mapped_column(String(1024), nullable=False)
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    account_id: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    account_email: Mapped[str] = mapped_column(String(320), nullable=False)
    user_id: Mapped[GUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="cascade"), nullable=False
    )


class User(RecordModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(1024), nullable=False)
    profile: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, default={}, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(
        OAuthAccount, lazy="joined"
    )

    organization_associations: "Mapped[list[UserOrganization]]" = relationship(
        "UserOrganization",
        back_populates="user",
        lazy="raise_on_sql",
    )

    organizations: AssociationProxy[list["Organization"]] = association_proxy(
        "organization_associations", "organization"
    )

    __mutables__ = {email, profile}

    def get_primary_oauth_account(self) -> OAuthAccount:
        return self.oauth_accounts[0]

    def get_platform_oauth_account(self, platform: Platforms) -> OAuthAccount | None:
        for account in self.oauth_accounts:
            if account.oauth_name == platform.value:
                return account
        return None
