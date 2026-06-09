from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from polar.db import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(unique=True)
    body: Mapped[dict[str, Any]] = mapped_column(JSON)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
