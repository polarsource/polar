from sqlalchemy import Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class BackofficeUser(RecordModel):
    __tablename__ = "backoffice_users"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    provider_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, index=True, unique=True
    )

    __table_args__ = (
        Index(
            "ix_backoffice_users_normalized_email",
            func.lower(func.btrim(email)),
            unique=True,
        ),
    )
