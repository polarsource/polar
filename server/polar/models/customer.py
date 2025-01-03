import dataclasses
import time
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    String,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.kit.tax import TaxID, TaxIDType

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class CustomerOAuthPlatform(StrEnum):
    github = "github"
    discord = "discord"

    def get_account_key(self, account_id: str) -> str:
        return f"{self.value}:{account_id}"

    def get_account_id(self, data: dict[str, Any]) -> str:
        if self == CustomerOAuthPlatform.github:
            return str(data["id"])
        if self == CustomerOAuthPlatform.discord:
            return str(data["id"])
        raise NotImplementedError()

    def get_account_username(self, data: dict[str, Any]) -> str:
        if self == CustomerOAuthPlatform.github:
            return data["login"]
        if self == CustomerOAuthPlatform.discord:
            return data["username"]
        raise NotImplementedError()


@dataclasses.dataclass
class CustomerOAuthAccount:
    access_token: str
    account_id: str
    account_username: str | None = None
    expires_at: int | None = None
    refresh_token: str | None = None
    refresh_token_expires_at: int | None = None

    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at


class Customer(MetadataMixin, RecordModel):
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customers_email_case_insensitive", func.lower(Column("email"))),
        Index(
            "ix_customers_organization_id_email_case_insensitive",
            "organization_id",
            func.lower(Column("email")),
            unique=True,
        ),
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, unique=False
    )

    name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    billing_address: Mapped[Address | None] = mapped_column(
        AddressType, nullable=True, default=None
    )
    tax_id: Mapped[TaxID | None] = mapped_column(TaxIDType, nullable=True, default=None)

    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def user(cls) -> Mapped["User | None"]:
        return relationship(
            "User",
            lazy="raise",
            back_populates="customers",
            foreign_keys="[Customer.user_id]",
        )

    _oauth_accounts: Mapped[dict[str, dict[str, Any]]] = mapped_column(
        "oauth_accounts", JSONB, nullable=False, default=dict
    )

    _legacy_user_id: Mapped[UUID | None] = mapped_column(
        "legacy_user_id",
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
    )
    """
    Before implementing customers, every customer was a user. This field is used to
    keep track of the user that originated this customer.

    It helps us keep backwards compatibility with integrations that used the user ID as
    reference to the customer.

    For new customers, this field will be null.
    """

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    def get_oauth_account(
        self, account_id: str, platform: CustomerOAuthPlatform
    ) -> CustomerOAuthAccount | None:
        oauth_account_data = self._oauth_accounts.get(
            platform.get_account_key(account_id)
        )
        if oauth_account_data is None:
            return None

        return CustomerOAuthAccount(**oauth_account_data)

    def set_oauth_account(
        self, oauth_account: CustomerOAuthAccount, platform: CustomerOAuthPlatform
    ) -> None:
        account_key = platform.get_account_key(oauth_account.account_id)
        self._oauth_accounts = {
            **self._oauth_accounts,
            account_key: dataclasses.asdict(oauth_account),
        }

    def remove_oauth_account(
        self, account_id: str, platform: CustomerOAuthPlatform
    ) -> None:
        account_key = platform.get_account_key(account_id)
        self._oauth_accounts = {
            k: v for k, v in self._oauth_accounts.items() if k != account_key
        }

    @property
    def oauth_accounts(self) -> dict[str, Any]:
        return self._oauth_accounts

    @property
    def legacy_user_id(self) -> UUID:
        return self._legacy_user_id or self.id

    @property
    def legacy_user_public_name(self) -> str:
        if self.name:
            return self.name[0]
        return self.email[0]
