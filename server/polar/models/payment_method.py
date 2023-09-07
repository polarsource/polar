from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.user import User


class PaymentMethod(RecordModel):
    __tablename__ = "payment_methods"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=False
    )

    stripe_payment_method_id: Mapped[str] = mapped_column(String, nullable=False)

    type: Mapped[str] = mapped_column(String, nullable=False)  # "card"

    brand: Mapped[str] = mapped_column(
        String, nullable=False
    )  # "visa" / "mastercard" / etc

    last4: Mapped[str] = mapped_column(String, nullable=False)
