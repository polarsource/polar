from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now
from polar.models.customer import Customer


def get_expires_at() -> datetime:
    return utc_now() + timedelta(seconds=settings.EMAIL_VERIFICATION_TTL_SECONDS)


class CustomerEmailVerification(RecordModel):
    __tablename__ = "customer_email_verifications"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    token_hash: Mapped[str] = mapped_column(
        String, index=True, unique=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=get_expires_at
    )
    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False, index=True
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def customer(cls) -> Mapped[Customer]:
        return relationship(Customer, lazy="raise")
