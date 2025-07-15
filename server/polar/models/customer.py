import dataclasses
import time
from collections.abc import Sequence
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
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
    from .benefit_grant import BenefitGrant
    from .customer_meter import CustomerMeter
    from .organization import Organization
    from .payment_method import PaymentMethod
    from .subscription import Subscription


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
        Index(
            "ix_customers_email_case_insensitive",
            func.lower(Column("email")),
            "deleted_at",
            postgresql_nulls_not_distinct=True,
        ),
        Index(
            "ix_customers_organization_id_email_case_insensitive",
            "organization_id",
            func.lower(Column("email")),
            "deleted_at",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
        UniqueConstraint("organization_id", "external_id"),
    )

    external_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, unique=False
    )

    name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    _billing_name: Mapped[str | None] = mapped_column(
        "billing_name", String, nullable=True, default=None
    )
    billing_address: Mapped[Address | None] = mapped_column(
        AddressType, nullable=True, default=None
    )
    tax_id: Mapped[TaxID | None] = mapped_column(TaxIDType, nullable=True, default=None)

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
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def payment_methods(cls) -> Mapped[Sequence["PaymentMethod"]]:
        return relationship(
            "PaymentMethod",
            lazy="raise",
            back_populates="customer",
            cascade="all, delete-orphan",
            foreign_keys="[PaymentMethod.customer_id]",
        )

    default_payment_method_id: Mapped[UUID | None] = mapped_column(
        "default_payment_method_id",
        Uuid,
        ForeignKey("payment_methods.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def default_payment_method(cls) -> Mapped["PaymentMethod | None"]:
        return relationship(
            "PaymentMethod",
            lazy="raise",
            uselist=False,
            foreign_keys=[cls.default_payment_method_id],  # type: ignore
        )

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

    @property
    def active_subscriptions(self) -> Sequence["Subscription"] | None:
        return getattr(self, "_active_subscriptions", None)

    @active_subscriptions.setter
    def active_subscriptions(self, value: Sequence["Subscription"]) -> None:
        self._active_subscriptions = value

    @property
    def granted_benefits(self) -> Sequence["BenefitGrant"] | None:
        return getattr(self, "_granted_benefits", None)

    @granted_benefits.setter
    def granted_benefits(self, value: Sequence["BenefitGrant"]) -> None:
        self._granted_benefits = value

    @property
    def active_meters(self) -> Sequence["CustomerMeter"] | None:
        return getattr(self, "_active_meters", None)

    @active_meters.setter
    def active_meters(self, value: Sequence["CustomerMeter"]) -> None:
        self._active_meters = value

    @property
    def billing_name(self) -> str | None:
        return self._billing_name or self.name

    @billing_name.setter
    def billing_name(self, value: str | None) -> None:
        self._billing_name = value
