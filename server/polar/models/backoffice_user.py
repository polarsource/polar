from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class BackofficeUser(RecordModel):
    __tablename__ = "backoffice_users"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    provider_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, index=True
    )
