from datetime import datetime
from uuid import UUID

from sqlalchemy import CHAR, TIMESTAMP, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.db.models.base import RecordModel
from polar.kit.utils import utc_now
from polar.models.customer import Customer


def get_expires_at() -> datetime:
    return utc_now() + settings.CUSTOMER_SESSION_TTL


class CustomerSession(RecordModel):
    __tablename__ = "customer_sessions"

    token: Mapped[str] = mapped_column(CHAR(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True, default=get_expires_at
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def customer(cls) -> Mapped[Customer]:
        return relationship(Customer, lazy="joined")

    @property
    def raw_token(self) -> str | None:
        return getattr(self, "_raw_token", None)

    @raw_token.setter
    def raw_token(self, value: str) -> None:
        self._raw_token = value
