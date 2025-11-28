from datetime import datetime
from urllib.parse import urlencode
from uuid import UUID

from sqlalchemy import CHAR, TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.db.models.base import RecordModel
from polar.kit.utils import utc_now

from .customer import Customer


def get_expires_at() -> datetime:
    return utc_now() + settings.CUSTOMER_SESSION_TTL


class CustomerSession(RecordModel):
    __tablename__ = "customer_sessions"

    token: Mapped[str] = mapped_column(CHAR(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True, default=get_expires_at
    )
    return_url: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False, index=True
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

    @property
    def customer_portal_url(self) -> str:
        query_string = urlencode(
            {"customer_session_token": self.raw_token, "email": self.customer.email}
        )
        return settings.generate_frontend_url(
            f"/{self.customer.organization.slug}/portal?{query_string}"
        )
