import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, ForeignKeyConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .customer import Customer
    from .organization import Organization
    from .void_billing_identity import VoidBillingIdentity


class VoidCustomerBinding(RecordModel):
    __tablename__ = "void_customer_bindings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "billing_identity_id"],
            ["void_billing_identities.organization_id", "void_billing_identities.id"],
        ),
    )

    # The binding service must require a customer in this organization and a root identity.
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=False, unique=True
    )
    billing_identity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, unique=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    customer: Mapped["Customer"] = relationship(
        primaryjoin="and_(VoidCustomerBinding.customer_id == Customer.id, VoidCustomerBinding.organization_id == Customer.organization_id)",
        foreign_keys=[customer_id],
        lazy="raise",
    )
    billing_identity: Mapped["VoidBillingIdentity"] = relationship(
        foreign_keys=[billing_identity_id], lazy="raise"
    )
    organization: Mapped["Organization"] = relationship(lazy="raise")
