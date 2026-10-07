from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model


class EventSequence(Model):
    """Last sequence number handed out to an organization's event ingestion."""

    __tablename__ = "event_sequences"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), primary_key=True
    )
    last_sequence: Mapped[int] = mapped_column(BigInteger, nullable=False)
