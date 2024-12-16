from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

from .customer import Customer
from .user import User


class UserCustomer(RecordModel):
    __tablename__ = "user_customers"
    __table_args__ = (UniqueConstraint("user_id", "customer_id"),)

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False
    )
    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship(User, lazy="raise", back_populates="user_customers")

    @declared_attr
    def customer(cls) -> Mapped[Customer]:
        # This is an association table, so eager loading makes sense
        return relationship(Customer, lazy="joined")
