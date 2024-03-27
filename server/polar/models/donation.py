from uuid import UUID

from sqlalchemy import (
    BigInteger,
    ForeignKey,
    String,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.organization import Organization


class Donation(RecordModel):
    __tablename__ = "donations"

    to_organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=False
    )

    # Stripe Payment Intents
    payment_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
        index=True,
    )

    # Stripe Charge ID
    charge_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    email: Mapped[str] = mapped_column(String, nullable=False, index=True)

    message: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)

    amount_received: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=None
    )

    # by_user_id, by_organization_id are mutually exclusive
    #
    # They determine who paid for this pledge (or who's going to pay for it).
    by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
        default=None,
    )

    by_organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        default=None,
    )

    # on_behalf_of_organization_id can be set when by_user_id is set.
    # This means that the "credz" if the pledge will go to the organization, but that
    # the by_user_id-user is still the one that paid/will pay for the pledge.
    #
    # on_behalf_of_organization_id can not be set when by_organization_id is set.
    on_behalf_of_organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        default=None,
    )

    # created_by_user_id is the user/actor that created the pledge, unrelated to who's
    # going to pay for it.
    #
    # If by_organization_id is set, this is the user that pressed the "Pledge" button.
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
        default=None,
    )

    @declared_attr
    def to_organization(cls) -> Mapped[Organization]:
        return relationship(
            Organization,
            primaryjoin=Organization.id == cls.to_organization_id,
            lazy="raise",
        )
